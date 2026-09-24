import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps the feed library and Jev receipts server-only and caps intake runs', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(readFileSync('supabase/migrations/007_feed_library.sql', 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`reset role; set role ${role}`);
      await expect(db.query('select * from meridian_feed_items')).rejects.toThrow(/permission denied/);
      await expect(db.query('select * from jev_decisions')).rejects.toThrow(/permission denied/);
      await expect(db.query('select claim_meridian_feed_run()')).rejects.toThrow(/permission denied/);
    }

    await db.exec('reset role; set role service_role');
    expect((await db.query('select claim_meridian_feed_run() as claimed')).rows).toEqual([{ claimed: true }]);
    expect((await db.query('select claim_meridian_feed_run() as claimed')).rows).toEqual([{ claimed: false }]);
    await db.exec("update meridian_feed_control set last_started_at = now() - interval '21 hours'");
    expect((await db.query('select claim_meridian_feed_run() as claimed')).rows).toEqual([{ claimed: true }]);

    // Excerpts are capped to a short quote at the database, not just in code.
    await expect(db.exec(`insert into meridian_feed_items (id, source_name, source_feed, source_tier, url, title, excerpt, published_at)
      values ('x', 'S', 'https://s.example/feed', 'A', 'https://s.example/a', 'T', '${'x'.repeat(261)}', now())`)).rejects.toThrow(/check constraint/);
    await expect(db.exec(`insert into meridian_feed_items (id, source_name, source_feed, source_tier, url, title, published_at)
      values ('y', 'S', 'https://s.example/feed', 'A', 'javascript:alert(1)', 'T', now())`)).rejects.toThrow(/check constraint/);
    await db.exec(`insert into jev_decisions (contract, subject, state_hash, route) values ('feed-item@1', 'x', 'h', 'review')`);
    expect((await db.query('select action_taken from jev_decisions')).rows).toEqual([{ action_taken: false }]);
  } finally {
    await db.close();
  }
});
