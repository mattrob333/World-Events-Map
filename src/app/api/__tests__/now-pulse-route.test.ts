import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/now/pulseService', () => ({ executePulse: vi.fn() }));
const { member } = vi.hoisted(() => ({ member: { current: { id: 'member-1', email: null } as Response | { id: string; email: null } } }));
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => member.current }));

import { NowProviderBudgetExceededError, NowSearchBudgetError } from '@/lib/now/providerBudget';
import { executePulse } from '@/lib/now/pulseService';
import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';
import { POST } from '../now/pulse/route';

const mocked = vi.mocked(executePulse);

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/now/pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.20', ...headers },
    body,
  });
}

const empty = { venues: [], source: 'besttime' as const, generatedAt: '2026-09-26T00:00:00Z', center: { lat: 33.75, lng: -84.39 } };

afterEach(() => {
  member.current = { id: 'member-1', email: null };
  vi.unstubAllEnvs();
  mocked.mockReset();
  resetNowRateLimitsForTests();
});

describe('POST /api/now/pulse', () => {
  it('says honestly when foot traffic is not connected, without calling the provider', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
    const response = await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'NOW_PROVIDER_NOT_CONFIGURED' });
    expect(mocked).not.toHaveBeenCalled();
  });

  it('refuses other sites', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    const response = await POST(request(JSON.stringify({ location: { lat: 1, lng: 1 } }), { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(mocked).not.toHaveBeenCalled();
  });

  it('needs a real location', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    const response = await POST(request(JSON.stringify({ location: { lat: 200, lng: 0 } })));
    expect(response.status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it('returns the busiest places', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockResolvedValue({ venues: [], source: 'besttime', generatedAt: '2026-09-26T00:00:00Z', center: { lat: 33.75, lng: -84.39 } });
    const response = await POST(request(JSON.stringify({ location: { lat: 33.7512, lng: -84.3901 } })));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    // No radius: the one-mile map (plus the phone's slack), charged to the member's own daily share.
    expect(mocked).toHaveBeenCalledWith({ lat: 33.7512, lng: -84.3901 }, 'surprise', 2409, expect.objectContaining({ take: expect.any(Function), refund: expect.any(Function) }));
  });

  it('is members only', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    member.current = new Response('no', { status: 401 });
    expect((await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })))).status).toBe(401);
    expect(mocked).not.toHaveBeenCalled();
  });

  it('searches only the map’s own radii: any other number snaps to the nearest', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockResolvedValue(empty);
    for (const [asked, searched] of [[3219 + 800, 4019], [8047 + 800, 8847], [12_345, 8847], [2410, 2409], [801, 2409], [1e9, 8847]]) {
      mocked.mockClear();
      await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 }, radiusMeters: asked })));
      expect(mocked.mock.calls[0][2]).toBe(searched);
    }
  });

  it('limits each member on their own, whatever address they come from', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockResolvedValue(empty);
    const body = JSON.stringify({ location: { lat: 33.75, lng: -84.39 } });
    for (let i = 0; i < 12; i += 1) expect((await POST(request(body, { 'x-vercel-forwarded-for': `203.0.113.${i}` }))).status).toBe(200);
    expect((await POST(request(body, { 'x-vercel-forwarded-for': '198.51.100.1' }))).status).toBe(429);
    member.current = { id: 'member-2', email: null };
    expect((await POST(request(body))).status).toBe(200);
  });

  it('says plainly when the member’s daily searches are used up', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockRejectedValue(new NowSearchBudgetError('member', Date.parse('2026-09-26T23:00:00Z')));
    const response = await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    const body = await response.json();
    expect(body.code).toBe('NOW_DAILY_LIMIT');
    expect(body.error).toMatch(/used today’s foot-traffic searches/);
  });

  it('says plainly when the site’s daily searches are used up', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockRejectedValue(new NowSearchBudgetError('site'));
    const response = await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toMatch(/at today’s limit/);
  });

  it('turns a spent budget into a polite retry', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockRejectedValue(new NowProviderBudgetExceededError(120));
    const response = await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
  });
});
