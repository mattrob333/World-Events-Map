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
const row = (user: string, kind: string, localId: string, data = `{"name":"Family"}`) =>
  `insert into traveler_state(user_id,kind,local_id,data,updated_at) values('${user}','${kind}','${localId}','${data}'::jsonb,now())`;

beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );
  await db.exec(readFileSync('supabase/migrations/010_traveler_state.sql', 'utf8'));
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);
}, 30000);
afterAll(async () => {
  await db.close();
});

describe('groups, trips and "you" in the account', () => {
  it('only the owner can read or write them', async () => {
    await asUser(a);
    await db.exec(row(a, 'group', 'grp-family'));
    expect((await db.query('select kind, local_id from traveler_state')).rows).toEqual([{ kind: 'group', local_id: 'grp-family' }]);
    await expect(db.exec(row(b, 'group', 'sneaky'))).rejects.toThrow(/row-level security/);

    await asUser(b);
    expect((await db.query('select * from traveler_state')).rows).toHaveLength(0);
    await db.exec(`update traveler_state set data='{"name":"Mine"}'::jsonb where user_id='${a}'`);
    await db.exec(`delete from traveler_state where user_id='${a}'`);
    await asUser(a);
    expect((await db.query<{ data: { name: string } }>('select data from traveler_state')).rows).toEqual([{ data: { name: 'Family' } }]);

    await asUser(null);
    await expect(db.query('select * from traveler_state')).rejects.toThrow(/permission denied/);
  });

  it('checks kinds, ids, sizes and tombstones', async () => {
    await asUser(a);
    await expect(db.exec(row(a, 'secret', 'x'))).rejects.toThrow(/check constraint/);
    await expect(db.exec(row(a, 'group', 'bad id!'))).rejects.toThrow(/check constraint/);
    await expect(db.exec(row(a, 'you', 'not-you'))).rejects.toThrow(/check constraint/);
    await expect(db.exec(row(a, 'group', 'big', `{"blob":"${'x'.repeat(50_001)}"}`))).rejects.toThrow(/check constraint/);
    // A trip may be larger, within reason.
    await db.exec(row(a, 'trip', 'trip-1', `{"blob":"${'x'.repeat(200_000)}"}`));
    await expect(db.exec(row(a, 'trip', 'trip-2', `{"blob":"${'x'.repeat(400_001)}"}`))).rejects.toThrow(/check constraint/);
    await expect(db.exec(`update traveler_state set deleted=true where local_id='grp-family'`)).rejects.toThrow(/check constraint/);
    await db.exec(`update traveler_state set deleted=true, data='{}'::jsonb, updated_at=now() + interval '1 second' where local_id='grp-family'`);
  });

  it('keeps one "you" row, and an item can\'t change kind', async () => {
    await asUser(a);
    await db.exec(row(a, 'you', 'you', '{"meId":"mb-1"}'));
    await expect(db.exec(row(a, 'you', 'you', '{"meId":"mb-2"}'))).rejects.toThrow(/duplicate key/);
    await expect(db.exec(`update traveler_state set kind='group', updated_at=now() + interval '1 second' where kind='you'`)).rejects.toThrow(/change what it is/);
  });

  it('caps live groups and trips per member, and tombstones can\'t get around it', async () => {
    await asUser(b);
    for (let i = 0; i < 40; i += 1) await db.exec(row(b, 'group', `g${i}`));
    await expect(db.exec(row(b, 'group', 'g40'))).rejects.toThrow(/Too many/);
    // Trips are counted on their own.
    for (let i = 0; i < 20; i += 1) await db.exec(row(b, 'trip', `t${i}`, '{"x":1}'));
    await expect(db.exec(row(b, 'trip', 't20', '{"x":1}'))).rejects.toThrow(/Too many/);
    // Updating an existing one still works.
    await db.exec(`${row(b, 'group', 'g3', '{"name":"Updated"}')} on conflict (user_id, kind, local_id) do update set data = excluded.data, updated_at = excluded.updated_at`);
    // Tombstones up to 300 rows in all, but none come back to life past the cap.
    for (let i = 0; i < 240; i += 1) {
      await db.exec(`insert into traveler_state(user_id,kind,local_id,data,deleted,updated_at) values('${b}','group','d${i}','{}'::jsonb,true,now())`);
    }
    await expect(db.exec(`insert into traveler_state(user_id,kind,local_id,data,deleted,updated_at) values('${b}','group','d-last','{}'::jsonb,true,now())`)).rejects.toThrow(/Too many/);
    await expect(db.exec(`update traveler_state set deleted=false, data='{"x":1}'::jsonb, updated_at=now() + interval '1 second' where local_id='d1'`)).rejects.toThrow(/Too many/);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from traveler_state where kind='group' and not deleted`)).rows[0]?.n).toBe(40);
  });

  it('never tells one member anything about another member\'s rows', async () => {
    await asUser(a);
    await expect(db.exec(row(b, 'group', 'fresh-id'))).rejects.toThrow(/row-level security/);
    await expect(db.exec(row(b, 'group', 'g3'))).rejects.toThrow(/row-level security/);
  });

  it('clamps future timestamps and skips updates older than what is stored', async () => {
    await asUser(a);
    await db.exec(`insert into traveler_state(user_id,kind,local_id,data,updated_at) values('${a}','group','clock','{"name":"Future"}'::jsonb, now() + interval '10 years')`);
    const stored = (await db.query<{ ahead: boolean }>(`select updated_at <= now() + interval '6 minutes' as ahead from traveler_state where local_id='clock'`)).rows[0];
    expect(stored?.ahead).toBe(true);
    await db.exec(`update traveler_state set data='{"name":"Stale"}'::jsonb, updated_at = now() - interval '1 day' where local_id='clock'`);
    expect((await db.query<{ data: { name: string } }>(`select data from traveler_state where local_id='clock'`)).rows[0]?.data.name).toBe('Future');
  });
});
