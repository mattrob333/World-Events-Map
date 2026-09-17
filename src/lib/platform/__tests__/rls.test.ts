import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const db = new PGlite();
const a = '00000000-0000-0000-0000-000000000001',
  b = '00000000-0000-0000-0000-000000000002',
  c = '00000000-0000-0000-0000-000000000003';
const org = '10000000-0000-0000-0000-000000000001',
  offer = '20000000-0000-0000-0000-000000000001',
  circle = '30000000-0000-0000-0000-000000000001';
async function asUser(id: string) {
  await db.exec(
    `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`,
  );
  const migration = readFileSync(
    'supabase/migrations/001_platform.sql',
    'utf8',
  ).replace('create extension if not exists pgcrypto;', '');
  await db.exec(migration);
  await db.exec(`insert into auth.users values('${a}'),('${b}'),('${c}');`);
}, 30000);
afterAll(async () => {
  await db.close();
});
describe('platform RLS against PostgreSQL', () => {
  it('automatically creates private profiles and prevents cross-account profile reads', async () => {
    await asUser(a);
    expect((await db.query('select * from profiles')).rows).toHaveLength(1);
    expect((await db.query('select is_public from profiles')).rows[0]).toEqual({
      is_public: false,
    });
  });
  it('provider cannot self-approve, even after application', async () => {
    await asUser(a);
    await db.exec(
      `insert into provider_orgs(id,owner_id,name,category) values('${org}','${a}','Test stays','hotel');`,
    );
    await expect(
      db.exec(`update provider_orgs set status='approved' where id='${org}'`),
    ).rejects.toThrow(/administrator/);
    await db.exec(
      `insert into offers(id,provider_id,destination,title,description,kind,expires_at) values('${offer}','${org}','Paris','A private suite','Three nights with breakfast included','stay',now()+interval '2 days');`,
    );
    await expect(
      db.exec(`update offers set status='published' where id='${offer}'`),
    ).rejects.toThrow(/approved provider/);
  });
  it('hides draft offers, then exposes only approved published inventory', async () => {
    await db.exec('reset role; set role anon; reset request.jwt.claim.sub');
    expect((await db.query('select * from offers')).rows).toHaveLength(0);
    await db.exec(
      `reset role;update provider_orgs set status='approved' where id='${org}';`,
    );
    await asUser(a);
    await db.exec(`update offers set status='published' where id='${offer}';`);
    await db.exec('reset role;set role anon; reset request.jwt.claim.sub');
    expect((await db.query('select * from offers')).rows).toHaveLength(1);
  });
  it('restricts inquiries to the named traveler and provider', async () => {
    await asUser(b);
    await db.exec(
      `insert into inquiries(offer_id,traveler_id,message) values('${offer}','${b}','Please confirm three nights for two people');`,
    );
    await asUser(c);
    expect((await db.query('select * from inquiries')).rows).toHaveLength(0);
    await expect(
      db.exec(
        `insert into inquiries(offer_id,traveler_id,message) values('${offer}','${b}','Impersonated request');`,
      ),
    ).rejects.toThrow(/row-level security/);
    await asUser(a);
    expect((await db.query('select * from inquiries')).rows).toHaveLength(1);
    await db.exec(
      "update inquiries set response='Available on request',status='replied'",
    );
    await expect(
      db.exec("update inquiries set message='changed request'"),
    ).rejects.toThrow(/original request/);
    await asUser(b);
    expect((await db.query('select response from inquiries')).rows[0]).toEqual({
      response: 'Available on request',
    });
  });
  it('requires approval before chat and enforces circle capacity', async () => {
    await asUser(a);
    await db.exec(
      `insert into circles(id,host_id,name,capacity) values('${circle}','${a}','Paris weekend',2);`,
    );
    expect((await db.query('select * from circle_members')).rows).toHaveLength(
      1,
    );
    await asUser(b);
    await db.exec(
      `insert into circle_members(circle_id,user_id) values('${circle}','${b}');`,
    );
    await expect(
      db.exec(
        `insert into circle_messages(circle_id,user_id,body) values('${circle}','${b}','Hello');`,
      ),
    ).rejects.toThrow(/row-level security/);
    await db.exec(
      `update circle_members set status='accepted' where user_id='${b}'`,
    );
    expect(
      (await db.query('select status from circle_members')).rows[0],
    ).toEqual({ status: 'pending' });
    await asUser(a);
    expect((await db.query('select * from profiles')).rows).toHaveLength(2);
    await db.exec(
      `update circle_members set status='accepted' where user_id='${b}';`,
    );
    await asUser(b);
    await db.exec(
      `insert into circle_messages(circle_id,user_id,body) values('${circle}','${b}','See you there');`,
    );
    await asUser(c);
    expect((await db.query('select * from circle_messages')).rows).toHaveLength(
      0,
    );
    await db.exec(
      `insert into circle_members(circle_id,user_id) values('${circle}','${c}');`,
    );
    await asUser(a);
    await expect(
      db.exec(
        `update circle_members set status='accepted' where user_id='${c}';`,
      ),
    ).rejects.toThrow(/full/);
  });
  it('revoked members lose conversation access', async () => {
    await asUser(a);
    await db.exec(
      `delete from circle_members where user_id='${b}' and circle_id='${circle}';`,
    );
    await asUser(b);
    expect((await db.query('select * from circle_messages')).rows).toHaveLength(
      0,
    );
  });
  it('provider event submissions stay private until admin moderation', async () => {
    await asUser(a);
    await db.exec(
      `insert into event_submissions(provider_id,name,description,destination,country,country_code,timezone,category,start_date,end_date,latitude,longitude) values('${org}','Private art evening','A hosted evening of art and dinner','Paris','France','FR','Europe/Paris','art','2027-01-01','2027-01-01',48.8,2.3);`,
    );
    await db.exec('reset role;set role anon; reset request.jwt.claim.sub');
    expect(
      (await db.query('select * from event_submissions')).rows,
    ).toHaveLength(0);
    await db.exec(
      "reset role;update event_submissions set status='approved';set role anon; reset request.jwt.claim.sub",
    );
    expect(
      (await db.query('select * from event_submissions')).rows,
    ).toHaveLength(1);
  });
  it('rejects invalid country codes and non-IANA timezones', async () => {
    await asUser(a);
    const insert = (code: string, timezone: string) =>
      db.exec(
        `insert into event_submissions(provider_id,name,description,destination,country,country_code,timezone,category,start_date,end_date,latitude,longitude) values('${org}','Invalid location test','A gathering with invalid geography','Paris','France','${code}','${timezone}','art','2027-01-01','2027-01-01',48.8,2.3)`,
      );
    await expect(insert('fr', 'Europe/Paris')).rejects.toThrow(
      /check constraint/,
    );
    await expect(insert('FR', 'Imaginary/City')).rejects.toThrow(/IANA/);
  });
  it('suspension immediately hides published offers and approved events', async () => {
    await db.exec(
      `reset role;update provider_orgs set status='suspended' where id='${org}';set role anon; reset request.jwt.claim.sub;`,
    );
    expect((await db.query('select * from offers')).rows).toHaveLength(0);
    expect(
      (await db.query('select * from event_submissions')).rows,
    ).toHaveLength(0);
  });
});
