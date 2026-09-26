import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { member, liveBusyness } = vi.hoisted(() => ({
  member: { current: null as Response | { id: string; email: null } | null },
  liveBusyness: vi.fn(async (venueId: string) => ({ venueId, live: 80, usual: 50, delta: 30, checkedAt: '2026-09-26T23:00:00.000Z' })),
}));
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => member.current }));
vi.mock('@/lib/now/liveBusyness', async (actual) => ({ ...(await actual<typeof import('@/lib/now/liveBusyness')>()), liveBusyness }));

import { POST } from '../now/live/route';

const request = (body: unknown, ip = '203.0.113.20') => new Request('http://localhost/api/now/live', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': ip },
  body: JSON.stringify(body),
});

afterEach(() => { vi.unstubAllEnvs(); liveBusyness.mockClear(); });

it('is members only and never calls BestTime for visitors', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test');
  member.current = new Response('no', { status: 401 });
  expect((await POST(request({ venueId: 'ven_abc123' }))).status).toBe(401);
  expect(liveBusyness).not.toHaveBeenCalled();
});

it('checks the place id, then returns the live reading', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test');
  member.current = { id: 'member', email: null };
  expect((await POST(request({ venueId: '../x' }, '203.0.113.21'))).status).toBe(400);
  const ok = await POST(request({ venueId: 'ven_abc123' }, '203.0.113.22'));
  expect(ok.status).toBe(200);
  expect((await ok.json()).reading.live).toBe(80);
});

it('says so when foot traffic isn’t connected', async () => {
  member.current = { id: 'member', email: null };
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
  expect((await POST(request({ venueId: 'ven_abc123' }, '203.0.113.23'))).status).toBe(503);
});
