import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, expect, it } from 'vitest';

const db = new PGlite();
const a = '00000000-0000-0000-0000-000000000041';
const b = '00000000-0000-0000-0000-000000000042';

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
  await db.exec(platform);
  await db.exec(readFileSync('supabase/migrations/003_affinity_graph.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/005_profile_identity.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/007_profile_directory.sql', 'utf8'));
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);

  await asUser(a);
  await db.exec(`
    update profiles set
      display_name='Public Traveler', handle='public_traveler', tagline='Public tagline',
      home_city='Atlanta', home_airport='KATL', show_home_city=true,
      show_home_airport=false, interests=array['skiing'], is_public=true
    where id='${a}';
    insert into travel_modes(user_id,name,party_type,visibility,is_featured)
    values('${a}','Family Ski','family','discoverable',true);
  `);

  await asUser(b);
  await db.exec(`
    update profiles set
      display_name='Private Traveler', handle='private_traveler', home_city='Miami',
      interests=array['sailing'], is_public=false
    where id='${b}';
  `);
}, 30000);

afterAll(async () => {
  await db.close();
});

it('lists only sanitized public traveler summaries to anonymous callers', async () => {
  await db.exec(`reset role; set role anon; select set_config('request.jwt.claim.sub','',false);`);
  const result = await db.query<{ directory: unknown }>(
    `select list_public_traveler_profiles(40) as directory`,
  );
  const directory = result.rows[0]?.directory as Array<Record<string, unknown>>;

  expect(directory).toHaveLength(1);
  expect(directory[0]).toMatchObject({
    handle: 'public_traveler',
    display_name: 'Public Traveler',
    home_city: 'Atlanta',
    home_airport: '',
    interests: ['skiing'],
    featured_modes: ['Family Ski'],
  });
  expect(directory[0]).not.toHaveProperty('bio');

  await expect(db.query('select * from profiles')).rejects.toThrow(/permission denied/);
}, 30000);
