import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps NOW provider accounting private and atomically enforces the shared cap', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;',
    );
    await db.exec(
      readFileSync('supabase/migrations/004_now_provider_budget.sql', 'utf8'),
    );

    await db.exec('set role authenticated');
    await expect(
      db.query('select * from meridian_now_provider_budget'),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.query('select claim_meridian_now_provider_budget()'),
    ).rejects.toThrow(/permission denied/);

    await db.exec('reset role; set role service_role');
    const claims = await db.query<{ allowed: boolean }>(`
      select (claim_meridian_now_provider_budget()->>'allowed')::boolean as allowed
      from generate_series(1, 120)
    `);
    expect(claims.rows).toHaveLength(120);
    expect(claims.rows.every((row) => row.allowed)).toBe(true);

    const blocked = await db.query<{ allowed: boolean; retry: number }>(`
      select
        (claim->>'allowed')::boolean as allowed,
        (claim->>'retry_after_seconds')::integer as retry
      from (select claim_meridian_now_provider_budget() as claim) x
    `);
    expect(blocked.rows[0]?.allowed).toBe(false);
    expect(blocked.rows[0]?.retry).toBeGreaterThan(0);

    await db.exec('reset role');
    await db.exec(`
      update meridian_now_provider_budget
      set window_started_at = now() - interval '11 minutes'
      where name = 'global'
    `);
    await db.exec('set role service_role');

    const reset = await db.query<{ allowed: boolean; remaining: number }>(`
      select
        (claim->>'allowed')::boolean as allowed,
        (claim->>'remaining')::integer as remaining
      from (select claim_meridian_now_provider_budget() as claim) x
    `);
    expect(reset.rows).toEqual([{ allowed: true, remaining: 119 }]);
  } finally {
    await db.close();
  }
}, 30000);
