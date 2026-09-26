import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const getUser = vi.fn();
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser } }) }));

const { allowed, allowlist, requireMember, requireMcpToken } = await import('./member');

const request = (auth?: string) => new Request('http://localhost/api/now', { method: 'POST', headers: auth ? { Authorization: auth } : {} });

describe('members only', () => {
  afterEach(() => { vi.unstubAllEnvs(); getUser.mockReset(); });

  it('signed out gets 401; a verified member gets through', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    const none = await requireMember(request());
    expect(none instanceof Response && none.status).toBe(401);
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-1', email: 'Pilot@Example.com' } }, error: null });
    expect(await requireMember(request('Bearer token-aaaaaaaaaaaaaaaaaaaaaaaa'))).toEqual({ id: 'u-1', email: 'Pilot@Example.com' });
  });

  it('with an allowlist, other signed-in accounts get 403', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
    vi.stubEnv('MEMBER_ALLOWLIST', 'pilot@example.com');
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u-2', email: 'stranger@example.com' } }, error: null });
    const denied = await requireMember(request('Bearer token-bbbbbbbbbbbbbbbbbbbbbbbb'));
    expect(denied instanceof Response && denied.status).toBe(403);
    expect(allowed({ id: 'u-1', email: 'PILOT@example.com' }, allowlist('pilot@example.com, other@example.com'))).toBe(true);
    expect(allowlist('  ')).toBeNull();
  });

  it('production without sign-in configured is closed; local development is open', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    const closed = await requireMember(request());
    expect(closed instanceof Response && closed.status).toBe(503);
    vi.stubEnv('VERCEL_ENV', 'development');
    expect(await requireMember(request())).toEqual({ id: 'local-dev', email: null });
  });

  it('MCP needs its token; unset means closed', () => {
    vi.stubEnv('MCP_ACCESS_TOKEN', '');
    expect(requireMcpToken(request('Bearer anything'))?.status).toBe(401);
    vi.stubEnv('MCP_ACCESS_TOKEN', 'a-long-enough-secret-token-123');
    expect(requireMcpToken(request('Bearer a-long-enough-secret-token-123'))).toBeNull();
    expect(requireMcpToken(request('Bearer wrong'))?.status).toBe(401);
  });
});
