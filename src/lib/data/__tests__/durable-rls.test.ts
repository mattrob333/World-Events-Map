import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('keeps signal storage private and globally leases scheduled work', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(readFileSync('supabase/migrations/002_live_signals.sql', 'utf8'));
    await db.exec('set role anon');
    await expect(db.query('select * from meridian_signal_snapshots')).rejects.toThrow(/permission denied/);
    await expect(db.query('select claim_meridian_refresh()')).rejects.toThrow(/permission denied/);
    await db.exec('reset role; set role service_role');
    expect((await db.query('select claim_meridian_refresh() as claimed')).rows).toEqual([{ claimed: true }]);
    expect((await db.query('select claim_meridian_refresh() as claimed')).rows).toEqual([{ claimed: false }]);
    await db.exec("insert into meridian_signal_snapshots(event_id,patch) values('test','{\"socialMentions\":123}');");
    expect((await db.query('select event_id from meridian_signal_snapshots')).rows).toEqual([{ event_id: 'test' }]);
    await db.exec("update meridian_refresh_leases set expires_at=now()-interval '1 second';");
    expect((await db.query('select claim_meridian_refresh() as claimed')).rows).toEqual([{ claimed: true }]);
  } finally { await db.close(); }
}, 30000);
