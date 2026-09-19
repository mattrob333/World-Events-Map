import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const a = '00000000-0000-0000-0000-000000000021';
const b = '00000000-0000-0000-0000-000000000022';

async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}

async function asAnon() {
  await db.exec(
    `reset role; set role anon; select set_config('request.jwt.claim.sub','',false);`,
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
  const identity = readFileSync('supabase/migrations/005_profile_identity.sql', 'utf8');
  await db.exec(platform);
  await db.exec(affinity);
  await db.exec(identity);
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);
}, 30000);

afterAll(async () => {
  await db.close();
});

describe('first-class profile identity RLS', () => {
  it('returns a sanitized public payload without exposing private profile fields', async () => {
    await asUser(a);
    await db.exec(`
      update profiles set
        display_name='Traveler A',
        handle='Traveler_A',
        tagline='Powder, food, and good company.',
        bio='Public biography',
        home_city='Atlanta',
        home_airport='KATL',
        show_home_city=true,
        show_home_airport=false,
        interests=array['skiing','food'],
        is_public=true
      where id='${a}';

      insert into travel_modes(user_id,name,description,party_type,destination,visibility,is_featured)
      values
        ('${a}','Family Ski','School break ski trips','family','Aspen','discoverable',true),
        ('${a}','Private Solo','Not public','solo','Paris','private',true),
        ('${a}','Unfeatured','Discoverable but not featured','friends','Miami','discoverable',false);

      insert into profile_links(profile_id,kind,label,url,visibility,sort_order)
      values
        ('${a}','instagram','Instagram','https://instagram.com/example','public',1),
        ('${a}','website','Private site','https://private.example','private',2);

      insert into profile_places(profile_id,name,place_type,location_label,note,visibility,sort_order)
      values
        ('${a}','Aspen','city','Colorado','Favorite ski town','public',1),
        ('${a}','Secret cabin','other','Somewhere','Private favorite','private',2);
    `);

    await asAnon();
    const result = await db.query<{ profile: Record<string, unknown> | null }>(
      `select get_public_traveler_profile('traveler_a') as profile`,
    );
    const profile = result.rows[0]?.profile as {
      handle?: string;
      home_city?: string;
      home_airport?: string;
      links?: Array<{ label: string }>;
      places?: Array<{ name: string }>;
      travel_modes?: Array<{ name: string }>;
    } | null;

    expect(profile?.handle).toBe('traveler_a');
    expect(profile?.home_city).toBe('Atlanta');
    expect(profile?.home_airport).toBe('');
    expect(profile?.links?.map((item) => item.label)).toEqual(['Instagram']);
    expect(profile?.places?.map((item) => item.name)).toEqual(['Aspen']);
    expect(profile?.travel_modes?.map((item) => item.name)).toEqual(['Family Ski']);

    await expect(db.query('select * from profiles')).rejects.toThrow(/permission denied/);
    await expect(db.query('select * from profile_links')).rejects.toThrow(/permission denied/);
  });

  it('keeps private profiles out of the public RPC', async () => {
    await asUser(a);
    await db.exec(`update profiles set is_public=false where id='${a}';`);

    await asAnon();
    const result = await db.query<{ profile: unknown }>(
      `select get_public_traveler_profile('traveler_a') as profile`,
    );
    expect(result.rows[0]?.profile).toBeNull();

    await asUser(a);
    await db.exec(`update profiles set is_public=true where id='${a}';`);
  });

  it('prevents another member from mutating profile-owned child records', async () => {
    await asUser(b);
    await db.exec(
      `update profile_links set label='Hijacked' where profile_id='${a}';`,
    );

    await asUser(a);
    const result = await db.query<{ label: string }>(
      `select label from profile_links where profile_id='${a}' and visibility='public'`,
    );
    expect(result.rows[0]?.label).toBe('Instagram');
  });

  it('normalizes handles and rejects reserved or duplicate handles', async () => {
    await asUser(b);
    await expect(
      db.exec(`update profiles set handle='ADMIN' where id='${b}';`),
    ).rejects.toThrow(/reserved/);

    await expect(
      db.exec(`update profiles set handle='Traveler_A' where id='${b}';`),
    ).rejects.toThrow(/unique|duplicate/i);
  });
});
