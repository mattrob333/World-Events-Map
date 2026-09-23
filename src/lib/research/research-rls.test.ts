import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('keeps research private and caps scheduled paid sweeps across instances', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to service_role;');
    await db.exec(readFileSync('supabase/migrations/005_research.sql', 'utf8'));
    await db.exec('set role anon');
    await expect(db.query('select * from meridian_research_items')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from meridian_research_control')).rejects.toThrow(/permission denied/);
    await expect(db.query('select claim_meridian_research_run()')).rejects.toThrow(/permission denied/);

    await db.exec('reset role; set role authenticated');
    await expect(db.query('select * from meridian_research_control')).rejects.toThrow(/permission denied/);
    await expect(db.query('select claim_meridian_research_run()')).rejects.toThrow(/permission denied/);

    await db.exec('reset role; set role service_role');
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: true }]);
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: false }]);
    await db.exec("update meridian_research_control set window_started_at=now()-interval '9 hours', last_started_at=now()-interval '9 hours'");
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: true }]);
    await db.exec("update meridian_research_control set last_started_at=now()-interval '9 hours'");
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: false }]);

    // The first of two claims has expired, while the second is still within
    // the rolling day. The next claim is allowed, with the second carried on.
    await db.exec("update meridian_research_control set window_started_at=now()-interval '25 hours', last_started_at=now()-interval '9 hours'");
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: true }]);
    expect((await db.query(`select runs_in_window,
      window_started_at > now()-interval '10 hours' as kept_recent_claim
      from meridian_research_control`)).rows).toEqual([{
      runs_in_window: 2,
      kept_recent_claim: true,
    }]);

    // Eight hours later, both retained claims are still within 24 hours.
    // A fixed-window counter would admit a third claim here.
    await db.exec("update meridian_research_control set window_started_at=now()-interval '17 hours', last_started_at=now()-interval '8 hours 30 minutes'");
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: false }]);

    // Once both recorded claims have aged out, a new sweep starts normally.
    await db.exec("update meridian_research_control set window_started_at=now()-interval '34 hours', last_started_at=now()-interval '25 hours'");
    expect((await db.query('select claim_meridian_research_run() as claimed')).rows).toEqual([{ claimed: true }]);
    expect((await db.query('select runs_in_window from meridian_research_control')).rows).toEqual([{ runs_in_window: 1 }]);

    await expect(db.query(`insert into meridian_research_items
      (id,topic,category,source,platform,title,excerpt,url,fetched_at,reviewed_at,decision)
      values ('x','ski','article','exa','Web','Title','Excerpt','https://example.com',now(),now(),'publish')`))
      .rejects.toThrow(/meridian_research_published_requires_date/);
  } finally {
    await db.close();
  }
}, 30000);
