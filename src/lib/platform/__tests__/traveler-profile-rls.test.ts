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
  await db.exec(`reset role; set role anon; select set_config('request.jwt.claim.sub','',false);`);
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
  const identity = readFileSync(
    'supabase/migrations/004_traveler_profiles_and_inspiration.sql',
    'utf8',
  );
  await db.exec(platform);
  await db.exec(affinity);
  await db.exec(identity);
  await db.exec(`insert into auth.users values('${a}'),('${b}');`);
}, 30000);

afterAll(async () => {
  await db.close();
});

describe('traveler profile and inspiration privacy', () => {
  it('returns an explicit public snapshot without exposing hidden home-base fields', async () => {
    await asUser(a);
    await db.exec(
      `update profiles set
        display_name='Traveler A', handle='traveler_a', headline='Snow, food and good stories',
        home_city='Atlanta', home_airport='KATL', interests=array['skiing','food'],
        bio='Usually planning the next mountain trip.', is_public=true
       where id='${a}';`,
    );
    await db.exec(
      `insert into profile_links(user_id,kind,label,url) values
       ('${a}','instagram','Instagram','https://www.instagram.com/example/');`,
    );
    await db.exec(
      `insert into profile_places(user_id,kind,place_name,country_code,note) values
       ('${a}','favorite','Courchevel','FR','A winter favorite');`,
    );
    await db.exec(
      `insert into travel_modes(user_id,name,party_type,destination,visibility) values
       ('${a}','Family Ski','family','Courchevel','discoverable');`,
    );
    await db.exec(
      `select pin_profile_content(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ','youtube','Courchevel preview',
        'Getting hyped for the trip','Courchevel',true
      );`,
    );

    await asAnon();
    const visible = await db.query<{ traveler_snapshot: Record<string, unknown> }>(
      `select traveler_snapshot('traveler_a') as traveler_snapshot`,
    );
    const payload = visible.rows[0]?.traveler_snapshot as {
      profile: { home_city: string; home_airport: string; handle: string };
      links: unknown[];
      places: unknown[];
      content: unknown[];
      modes: unknown[];
    };
    expect(payload.profile.handle).toBe('traveler_a');
    expect(payload.profile.home_city).toBe('Atlanta');
    expect(payload.profile.home_airport).toBe('KATL');
    expect(payload.links).toHaveLength(1);
    expect(payload.places).toHaveLength(1);
    expect(payload.content).toHaveLength(1);
    expect(payload.modes).toHaveLength(1);

    await asUser(a);
    await db.exec(`update profiles set show_home_base=false where id='${a}';`);
    await asAnon();
    const hidden = await db.query<{ traveler_snapshot: Record<string, unknown> }>(
      `select traveler_snapshot('traveler_a') as traveler_snapshot`,
    );
    const hiddenProfile = (hidden.rows[0]?.traveler_snapshot as {
      profile: { home_city: string; home_airport: string };
    }).profile;
    expect(hiddenProfile.home_city).toBe('');
    expect(hiddenProfile.home_airport).toBe('');
  });

  it('keeps traveler profile editing tables owner-only', async () => {
    await asUser(b);
    expect((await db.query('select * from profile_links')).rows).toHaveLength(0);
    expect((await db.query('select * from profile_places')).rows).toHaveLength(0);
    expect((await db.query('select * from saved_content')).rows).toHaveLength(0);
  });

  it('shares inspiration only into circles where the traveler is accepted', async () => {
    await asUser(a);
    const created = await db.query<{ id: string }>(
      `insert into circles(host_id,name,destination,description,start_date,end_date)
       values('${a}','Courchevel Crew','Courchevel','Ski week','2027-02-12','2027-02-18') returning id`,
    );
    const circle = created.rows[0]!.id;

    await asUser(b);
    await expect(
      db.exec(
        `select share_circle_content(
          '${circle}','https://www.youtube.com/watch?v=abc12345678','youtube',
          'Ski film','','Courchevel','Watch this before we go'
        );`,
      ),
    ).rejects.toThrow(/Accepted circle membership required/);

    await db.exec(
      `insert into circle_members(circle_id,user_id,status) values('${circle}','${b}','pending');`,
    );
    await asUser(a);
    await db.exec(
      `update circle_members set status='accepted' where circle_id='${circle}' and user_id='${b}';`,
    );

    await asUser(b);
    await db.exec(
      `select share_circle_content(
        '${circle}','https://www.youtube.com/watch?v=abc12345678','youtube',
        'Ski film','','Courchevel','Watch this before we go'
      );`,
    );
    expect(
      (await db.query(`select * from circle_content where circle_id='${circle}'`)).rows,
    ).toHaveLength(1);
  });
});
