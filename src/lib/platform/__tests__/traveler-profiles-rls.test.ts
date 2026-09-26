import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const a = '00000000-0000-0000-0000-00000000000a';
const b = '00000000-0000-0000-0000-00000000000b';

async function asUser(id: string | null) {
  await db.exec(id
    ? `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`
    : `reset role; set role anon; select set_config('request.jwt.claim.sub','',false);`);
}
const row = (user: string, localId: string, data = `{"name":"Kelly"}`) =>
  `insert into traveler_profiles(user_id,local_id,label,engine,data,updated_at) values('${user}','${localId}','Family','claude','${data}'::jsonb,now())`;

beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(readFileSync('supabase/migrations/009_traveler_profiles.sql', 'utf8'));
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);
}, 30000);
afterAll(async () => {
  await db.close();
});

describe('traveler profiles in the account', () => {
  it('only the owner can read or write their profiles', async () => {
    await asUser(a);
    await db.exec(row(a, 'family-1'));
    expect((await db.query('select local_id from traveler_profiles')).rows).toEqual([{ local_id: 'family-1' }]);
    await expect(db.exec(row(b, 'sneaky'))).rejects.toThrow(/row-level security/);

    await asUser(b);
    expect((await db.query('select * from traveler_profiles')).rows).toHaveLength(0);
    await db.exec(`update traveler_profiles set label='Mine' where user_id='${a}'`);
    await db.exec(`delete from traveler_profiles where user_id='${a}'`);
    await asUser(a);
    expect((await db.query<{ label: string }>('select label from traveler_profiles')).rows).toEqual([{ label: 'Family' }]);

    await asUser(null);
    await expect(db.query('select * from traveler_profiles')).rejects.toThrow(/permission denied/);
  });

  it('keeps tombstones empty and profiles small', async () => {
    await asUser(a);
    await expect(db.exec(`update traveler_profiles set deleted=true where local_id='family-1'`)).rejects.toThrow(/check constraint/);
    await db.exec(`update traveler_profiles set deleted=true, data='{}'::jsonb where local_id='family-1'`);
    await expect(db.exec(row(a, 'big', `{"blob":"${'x'.repeat(100_001)}"}`))).rejects.toThrow(/check constraint/);
    await expect(db.exec(row(a, 'bad id!'))).rejects.toThrow(/check constraint/);
  });

  it('caps live profiles per member, not tombstones, and still lets existing ones be updated', async () => {
    await asUser(b);
    for (let i = 0; i < 40; i += 1) await db.exec(row(b, `p${i}`));
    await expect(db.exec(row(b, 'p40'))).rejects.toThrow(/Too many/);
    await db.exec(`${row(b, 'p3', '{"name":"Updated"}')} on conflict (user_id, local_id) do update set data = excluded.data, updated_at = excluded.updated_at`);
    expect((await db.query<{ data: { name: string } }>(`select data from traveler_profiles where local_id='p3'`)).rows[0]?.data.name).toBe('Updated');
    // Deleting one frees a slot: tombstones don't count.
    await db.exec(`update traveler_profiles set deleted=true, data='{}'::jsonb, updated_at=now() + interval '1 second' where local_id='p0'`);
    await db.exec(row(b, 'p40'));
  });

  it('tombstones can\'t be used to get around the cap', async () => {
    await asUser(b);
    // b has 40 live profiles. Tombstones are allowed, up to 200 rows in all...
    for (let i = 0; i < 159; i += 1) {
      await db.exec(`insert into traveler_profiles(user_id,local_id,data,deleted,updated_at) values('${b}','t${i}','{}'::jsonb,true,now())`);
    }
    await expect(db.exec(`insert into traveler_profiles(user_id,local_id,data,deleted,updated_at) values('${b}','t-last','{}'::jsonb,true,now())`)).rejects.toThrow(/Too many/);
    // ...but none can come back to life past 40 live, by update or by upsert.
    await expect(db.exec(`update traveler_profiles set deleted=false, data='{"x":1}'::jsonb, updated_at=now() + interval '1 second' where local_id='t1'`)).rejects.toThrow(/Too many/);
    await expect(db.exec(`insert into traveler_profiles(user_id,local_id,data,updated_at) values('${b}','t2','{"x":1}'::jsonb, now() + interval '1 second') on conflict (user_id, local_id) do update set deleted=false, data=excluded.data, updated_at=excluded.updated_at`)).rejects.toThrow(/Too many/);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from traveler_profiles where not deleted`)).rows[0]?.n).toBe(40);
  });

  it('never tells one member anything about another member\'s rows', async () => {
    await asUser(a);
    // b is at the cap and has p3; a's inserts under b's id get the RLS error either way.
    await expect(db.exec(row(b, 'fresh-id'))).rejects.toThrow(/row-level security/);
    await expect(db.exec(row(b, 'p3'))).rejects.toThrow(/row-level security/);
  });

  it('clamps future timestamps and skips updates older than what is stored', async () => {
    await asUser(a);
    await db.exec(`insert into traveler_profiles(user_id,local_id,data,updated_at) values('${a}','clock','{"name":"Future"}'::jsonb, now() + interval '10 years')`);
    const stored = (await db.query<{ ahead: boolean }>(`select updated_at <= now() + interval '6 minutes' as ahead from traveler_profiles where local_id='clock'`)).rows[0];
    expect(stored?.ahead).toBe(true);
    await db.exec(`update traveler_profiles set data='{"name":"Stale"}'::jsonb, updated_at = now() - interval '1 day' where local_id='clock'`);
    expect((await db.query<{ data: { name: string } }>(`select data from traveler_profiles where local_id='clock'`)).rows[0]?.data.name).toBe('Future');
  });
});
