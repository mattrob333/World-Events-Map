import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const a = '00000000-0000-0000-0000-000000000031';
const b = '00000000-0000-0000-0000-000000000032';
const c = '00000000-0000-0000-0000-000000000033';

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
  await db.exec(readFileSync('supabase/migrations/006_profile_connections.sql', 'utf8'));
  await db.exec(`insert into auth.users values('${a}'),('${b}'),('${c}');`);
}, 30000);

afterAll(async () => {
  await db.close();
});

describe('traveler connection RLS', () => {
  it('lets a member request a connection but not forge another requester', async () => {
    await asUser(a);
    await db.exec(
      `insert into profile_connections(requester_id,addressee_id) values('${a}','${b}');`,
    );
    await expect(
      db.exec(
        `insert into profile_connections(requester_id,addressee_id) values('${c}','${b}');`,
      ),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it('shows a connection only to its participants', async () => {
    await asUser(c);
    expect((await db.query('select * from profile_connections')).rows).toHaveLength(0);

    await asUser(a);
    expect((await db.query('select * from profile_connections')).rows).toHaveLength(1);

    await asUser(b);
    expect((await db.query('select * from profile_connections')).rows).toHaveLength(1);
  });

  it('allows only the addressee to accept a pending request', async () => {
    await asUser(a);
    await db.exec(`update profile_connections set status='accepted' where requester_id='${a}' and addressee_id='${b}';`);
    const stillPending = await db.query<{ status: string }>(
      `select status from profile_connections where requester_id='${a}' and addressee_id='${b}'`,
    );
    expect(stillPending.rows[0]?.status).toBe('pending');

    await asUser(b);
    await db.exec(`update profile_connections set status='accepted' where requester_id='${a}' and addressee_id='${b}';`);
    const accepted = await db.query<{ status: string }>(
      `select status from profile_connections where requester_id='${a}' and addressee_id='${b}'`,
    );
    expect(accepted.rows[0]?.status).toBe('accepted');
  });

  it('prevents duplicate reverse-direction relationships for the same pair', async () => {
    await asUser(b);
    await expect(
      db.exec(
        `insert into profile_connections(requester_id,addressee_id) values('${b}','${a}');`,
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });

  it('lets either participant remove the relationship', async () => {
    await asUser(a);
    await db.exec(`delete from profile_connections where requester_id='${a}' and addressee_id='${b}';`);
    expect((await db.query('select * from profile_connections')).rows).toHaveLength(0);
  });
});
