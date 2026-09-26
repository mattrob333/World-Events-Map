import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { jsonError } from '@/lib/designer/server/guard';

/**
 * Members only, for every route that spends money or runs a search.
 *
 * The browser sends the member's session token (`Authorization: Bearer …`,
 * see memberFetch). It is checked with Supabase Auth and remembered for a
 * minute. When MEMBER_ALLOWLIST is set (comma-separated emails or user ids),
 * only those accounts get in: sign-up is open, so "signed in" alone would
 * still let anyone use the tools.
 *
 * Local development without Supabase configured stays open; production
 * without it is closed.
 */
export type Member = { id: string; email: string | null };

const TTL_MS = 60_000;
const MAX_CACHED = 500;
const cache = new Map<string, { member: Member | null; at: number }>();

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

export function allowlist(raw = process.env.MEMBER_ALLOWLIST): Set<string> | null {
  const entries = (raw ?? '').split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return entries.length ? new Set(entries) : null;
}

export function allowed(member: Member, list: Set<string> | null): boolean {
  if (!list) return true;
  return list.has(member.id.toLowerCase()) || (member.email !== null && list.has(member.email.toLowerCase()));
}

async function verify(token: string): Promise<Member | null> {
  const key = hash(token);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.member;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token).catch(() => ({ data: { user: null }, error: true }));
  const member = !error && data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { member, at: Date.now() });
  return member;
}

/** Returns the member, or the response to send instead (401 sign in, 403 not on the list). */
export async function requireMember(request: Request): Promise<Member | Response> {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (!configured) {
    if (process.env.VERCEL_ENV === 'production') return jsonError(503, 'MEMBERS_UNAVAILABLE', 'Sign-in isn’t available right now.');
    return { id: 'local-dev', email: null };
  }
  const token = /^Bearer\s+(\S{20,4096})$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  const member = token ? await verify(token) : null;
  if (!member) return jsonError(401, 'SIGN_IN_REQUIRED', 'Sign in to use this.');
  if (!allowed(member, allowlist())) return jsonError(403, 'MEMBERS_ONLY', 'This is invite-only for now.');
  return member;
}

/** The MCP endpoint (AI agents): a shared secret, since agents don't carry a member session. Closed when unset. */
export function requireMcpToken(request: Request): Response | null {
  const secret = process.env.MCP_ACCESS_TOKEN?.trim();
  if (!secret || secret.length < 24) {
    return Response.json({ jsonrpc: '2.0', error: { code: -32001, message: 'This MCP server is private for now.' }, id: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const given = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]?.trim() ?? '';
  const ok = timingSafeEqual(Buffer.from(hash(given)), Buffer.from(hash(secret)));
  return ok ? null : Response.json({ jsonrpc: '2.0', error: { code: -32001, message: 'This MCP server is private for now.' }, id: null }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
}
