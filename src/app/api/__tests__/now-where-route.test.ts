import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { member, budget } = vi.hoisted(() => ({
  member: { current: null as Response | { id: string; email: null } | null },
  budget: { member: true, site: true },
}));
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => member.current }));
vi.mock('@/lib/designer/server/sharedBudget', () => ({
  takeSharedNamed: vi.fn(async () => budget.member),
  takeShared: vi.fn(async () => budget.site),
  refundSharedNamed: vi.fn(async () => undefined),
}));

import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';
import { normalQuery, parseWhere, resetWhereCacheForTests } from '@/lib/now/where';
import { POST } from '../now/where/route';

const fetchMock = vi.fn();
const request = (body: unknown) => new Request('http://localhost/api/now/where', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.51' },
  body: JSON.stringify(body),
});
const google = { places: [{ displayName: { text: 'Hotel Esencia' }, formattedAddress: 'Carretera Federal 307, Xpu-Ha, Q.R., Mexico', location: { latitude: 20.4676, longitude: -87.2622 }, utcOffsetMinutes: -300 }] };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  resetNowRateLimitsForTests();
  resetWhereCacheForTests();
  budget.member = true;
  budget.site = true;
});

it('is members only and never calls Google for strangers', async () => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'g');
  vi.stubGlobal('fetch', fetchMock);
  member.current = new Response('no', { status: 401 });
  expect((await POST(request({ query: 'hotel esencia' }))).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('finds a hotel with its point and local clock, and the same search costs once', async () => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'g');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(google), { status: 200 }));
  member.current = { id: 'member', email: null };
  const response = await POST(request({ query: '  Hotel  Esencia, Tulum ' }));
  expect(response.status).toBe(200);
  expect((await response.json()).places).toEqual([{ name: 'Hotel Esencia', address: 'Carretera Federal 307, Xpu-Ha, Q.R., Mexico', lat: 20.4676, lng: -87.2622, utcOffsetMinutes: -300 }]);
  const sent = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
  expect(sent).toEqual({ textQuery: 'hotel esencia, tulum', maxResultCount: 5 });
  expect(fetchMock.mock.calls[0]![1].headers['X-Goog-FieldMask']).toBe('places.displayName,places.formattedAddress,places.location,places.utcOffsetMinutes');
  await POST(request({ query: 'hotel esencia, tulum' }));
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('says plainly when the day’s searches are used up, without calling Google', async () => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'g');
  vi.stubGlobal('fetch', fetchMock);
  member.current = { id: 'member', email: null };
  budget.member = false;
  const response = await POST(request({ query: 'the ritz paris' }));
  expect(response.status).toBe(429);
  expect((await response.json()).code).toBe('WHERE_DAILY_LIMIT');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('rejects empty searches and is honest when Google is down or unset', async () => {
  member.current = { id: 'member', email: null };
  expect((await POST(request({ query: 'ab' }))).status).toBe(503);
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'g');
  vi.stubGlobal('fetch', fetchMock);
  expect((await POST(request({ query: 'ab' }))).status).toBe(400);
  fetchMock.mockResolvedValue(new Response('down', { status: 500 }));
  expect((await POST(request({ query: 'somewhere real' }))).status).toBe(502);
});

it('keeps only real places from Google', () => {
  expect(parseWhere({ places: [{ displayName: { text: 'X' } }, { displayName: { text: 'Y' }, location: { latitude: 99, longitude: 0 } }, ...google.places] })).toHaveLength(1);
  expect(normalQuery('  The  Ritz <b> , Paris ')).toBe('the ritz b , paris'.replace(' ,', ','));
});
