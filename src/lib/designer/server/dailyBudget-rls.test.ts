import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps daily provider budgets private, enforces each cap atomically, and refunds only the claimed day', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(readFileSync('supabase/migrations/008_daily_budgets.sql', 'utf8'));

    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      await expect(db.query('select * from meridian_daily_budget')).rejects.toThrow(/permission denied/);
      await expect(db.query("select claim_meridian_daily_budget('voice', 1, 60)")).rejects.toThrow(/permission denied/);
      await expect(db.query("select refund_meridian_daily_budget('voice', 1, current_date)")).rejects.toThrow(/permission denied/);
    }

    await db.exec('reset role; set role service_role');
    const claims = await db.query<{ day: string | null }>("select claim_meridian_daily_budget('voice', 1, 3) as day from generate_series(1, 5)");
    expect(claims.rows.filter((row) => row.day !== null)).toHaveLength(3);

    // A batch that would pass the cap is refused whole, and pools are separate.
    expect((await db.query<{ day: string | null }>("select claim_meridian_daily_budget('jev', 5, 4) as day")).rows[0]?.day).toBeNull();
    const granted = (await db.query<{ day: string }>("select claim_meridian_daily_budget('jev', 4, 4)::text as day")).rows[0]?.day;
    expect(granted).toBeTruthy();

    // A refund on the claimed day frees room; one for another day changes nothing.
    await db.query(`select refund_meridian_daily_budget('jev', 2, '${granted}'::date)`);
    await db.query(`select refund_meridian_daily_budget('jev', 2, '${granted}'::date - 1)`);
    const left = await db.query<{ day: string | null }>("select claim_meridian_daily_budget('jev', 1, 4) as day from generate_series(1, 3)");
    expect(left.rows.filter((row) => row.day !== null)).toHaveLength(2);

    await expect(db.query("select claim_meridian_daily_budget('bad pool!', 1, 3)")).rejects.toThrow(/invalid pool/);
    await expect(db.query("select claim_meridian_daily_budget('voice', 0, 3)")).rejects.toThrow(/invalid units/);
  } finally {
    await db.close();
  }
}, 30000);
