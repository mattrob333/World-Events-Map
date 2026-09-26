import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { member, liveBusyness } = vi.hoisted(() => ({
  member: { current: null as Response | { id: string; email: null } | null },
  liveBusyness: vi.fn(async (venueId: string) => ({ venueId, live: 80, usual: 50, delta: 30, checkedAt: '2026-09-26T23:00:00.000Z' })),
}));
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => member.current }));
vi.mock('@/lib/now/liveBusyness', async (actual) => ({ ...(await actual<typeof import('@/lib/now/liveBusyness')>()), liveBusyness }));

import { liveToken } from '@/lib/now/liveBusyness';
import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';
import { POST } from '../now/live/route';

const request = (body: unknown, ip = '203.0.113.20') => new Request('http://localhost/api/now/live', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': ip },
  body: JSON.stringify(body),
});

afterEach(() => { vi.unstubAllEnvs(); liveBusyness.mockClear(); resetNowRateLimitsForTests(); });

it('is members only and never calls BestTime for visitors', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test');
  member.current = new Response('no', { status: 401 });
  expect((await POST(request({ venueId: 'ven_abc123', token: liveToken('ven_abc123') }))).status).toBe(401);
  expect(liveBusyness).not.toHaveBeenCalled();
});

it('checks the place id, then returns the live reading', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test');
  member.current = { id: 'member', email: null };
  expect((await POST(request({ venueId: '../x' }, '203.0.113.21'))).status).toBe(400);
  // A place the map never showed (no valid token) never spends a credit.
  expect((await POST(request({ venueId: 'ven_abc123', token: 'made-up-token-xxxxxxxx' }, '203.0.113.21'))).status).toBe(403);
  expect(liveBusyness).not.toHaveBeenCalled();
  const ok = await POST(request({ venueId: 'ven_abc123', token: liveToken('ven_abc123') }, '203.0.113.22'));
  expect(ok.status).toBe(200);
  const text = await ok.text();
  expect(JSON.parse(text).reading.live).toBe(80);
  expect(text).not.toContain('test');
});

it('says so when foot traffic isn’t connected', async () => {
  member.current = { id: 'member', email: null };
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
  expect((await POST(request({ venueId: 'ven_abc123' }, '203.0.113.23'))).status).toBe(503);
});

it('has its own limit per member, so taps never starve the map', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test');
  member.current = { id: 'tapper', email: null };
  const body = { venueId: 'ven_abc123', token: liveToken('ven_abc123') };
  for (let i = 0; i < 30; i += 1) expect((await POST(request(body, '203.0.113.30'))).status).toBe(200);
  expect((await POST(request(body, '203.0.113.30'))).status).toBe(429);
  const { consumeNowClientRateLimit } = await import('@/lib/now/rateLimit');
  expect(consumeNowClientRateLimit(request(body, '203.0.113.30')).allowed).toBe(true);
});

it('turns a spent budget into a clear 429', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test');
  member.current = { id: 'member', email: null };
  const { LiveBudgetError } = await import('@/lib/now/liveBusyness');
  liveBusyness.mockImplementationOnce(async () => { throw new LiveBudgetError('You’ve used today’s live checks.'); });
  const response = await POST(request({ venueId: 'ven_abc123', token: liveToken('ven_abc123') }, '203.0.113.40'));
  expect(response.status).toBe(429);
  expect((await response.json()).error).toMatch(/usual for this hour still shows/);
});
