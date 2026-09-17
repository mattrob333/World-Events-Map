import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const a = '00000000-0000-0000-0000-000000000011';
const b = '00000000-0000-0000-0000-000000000012';
const publicMode = '10000000-0000-0000-0000-000000000011';
const privateMode = '10000000-0000-0000-0000-000000000012';

async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}

beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );

  const platform = readFileSync('supabase/migrations/001_platform.sql', 'utf8').replace(
    'create extension if not exists pgcrypto;',
    '',
  );
  const affinity = readFileSync('supabase/migrations/003_affinity_graph.sql', 'utf8');
  await db.exec(platform);
  await db.exec(affinity);
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);
}, 30000);

afterAll(async () => {
  await db.close();
});

describe('affinity graph RLS against PostgreSQL', () => {
  it('shows discoverable modes only when the owner profile is visible', async () => {
    await asUser(a);
    await db.exec(
      `update profiles set display_name='Traveler A',is_public=true,home_airport='KATL' where id='${a}';`,
    );
    await db.exec(
      `insert into travel_modes(id,user_id,name,party_type,origin_city,origin_airport,destination,visibility) values
       ('${publicMode}','${a}','Family Ski','family','Atlanta','KATL','Aspen','discoverable'),
       ('${privateMode}','${a}','Private Weekend','solo','Atlanta','KATL','Paris','private');`,
    );
    await db.exec(
      `insert into travel_mode_interests(mode_id,interest,weight) values
       ('${publicMode}','skiing',5),
       ('${privateMode}','nightlife',5);`,
    );

    await asUser(b);
    const visibleModes = await db.query<{ id: string; name: string }>(
      'select id,name from travel_modes order by name',
    );
    expect(visibleModes.rows).toEqual([{ id: publicMode, name: 'Family Ski' }]);

    const visibleInterests = await db.query<{ interest: string }>(
      'select interest from travel_mode_interests order by interest',
    );
    expect(visibleInterests.rows).toEqual([{ interest: 'skiing' }]);

    await asUser(a);
    await db.exec(`update profiles set is_public=false where id='${a}';`);

    await asUser(b);
    expect((await db.query('select * from travel_modes')).rows).toHaveLength(0);
    expect((await db.query('select * from travel_mode_interests')).rows).toHaveLength(0);
  });

  it('always lets the owner read and update their own private modes', async () => {
    await asUser(a);
    expect((await db.query('select * from travel_modes')).rows).toHaveLength(2);
    await db.exec(
      `update travel_modes set description='A private context' where id='${privateMode}';`,
    );
    const result = await db.query<{ description: string }>(
      `select description from travel_modes where id='${privateMode}'`,
    );
    expect(result.rows[0]?.description).toBe('A private context');
  });

  it('prevents another member from mutating someone else travel modes', async () => {
    await asUser(b);
    await db.exec(`update travel_modes set name='Hijacked' where id='${publicMode}'`);

    await asUser(a);
    const result = await db.query<{ name: string }>(
      `select name from travel_modes where id='${publicMode}'`,
    );
    expect(result.rows[0]?.name).toBe('Family Ski');
  });

  it('creates a travel mode and interests atomically', async () => {
    await asUser(a);
    const before = await db.query<{ count: number }>(
      'select count(*)::int as count from travel_modes',
    );

    const created = await db.query<{ id: string }>(`
      select public.create_travel_mode(
        'Atomic Solo',
        'A mode created through one database transaction',
        'solo',
        'Atlanta',
        'KATL',
        'Paris',
        null,
        null,
        'private',
        array['food','nightlife']
      ) as id;
    `);

    expect(created.rows[0]?.id).toBeTruthy();
    expect(
      (
        await db.query(
          `select * from travel_mode_interests where mode_id='${created.rows[0]?.id}' order by interest`,
        )
      ).rows,
    ).toHaveLength(2);

    const afterValid = await db.query<{ count: number }>(
      'select count(*)::int as count from travel_modes',
    );
    expect(afterValid.rows[0]?.count).toBe((before.rows[0]?.count ?? 0) + 1);

    await expect(
      db.query(`
        select public.create_travel_mode(
          'Broken Atomic Mode',
          '',
          'solo',
          '',
          '',
          '',
          null,
          null,
          'private',
          array[repeat('x',81)]
        );
      `),
    ).rejects.toThrow(/80 characters or fewer/);

    const afterFailure = await db.query<{ count: number }>(
      'select count(*)::int as count from travel_modes',
    );
    expect(afterFailure.rows[0]?.count).toBe(afterValid.rows[0]?.count);
  });

  it('rejects new circles without both dates at the persistence boundary', async () => {
    await asUser(a);
    await expect(
      db.exec(
        `insert into circles(host_id,name,destination,description,start_date,end_date)
         values('${a}','Undated circle','Aspen','Should never persist',null,null);`,
      ),
    ).rejects.toThrow(/requires both start and end dates/);

    await db.exec(
      `insert into circles(host_id,name,destination,description,start_date,end_date)
       values('${a}','Dated circle','Aspen','Valid dated circle','2027-02-12','2027-02-18');`,
    );
    expect((await db.query("select * from circles where name='Dated circle'")).rows).toHaveLength(1);
  });
});
