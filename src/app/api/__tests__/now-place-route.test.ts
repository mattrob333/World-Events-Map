import { afterEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { member, placeDetails } = vi.hoisted(() => ({
  member: { current: null as Response | { id: string; email: null } | null },
  placeDetails: vi.fn(async () => ({ type: 'Cocktail bar', rating: 4.6 })),
}));
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => member.current }));
vi.mock('@/lib/now/googlePlaces', () => ({ placeDetails }));

import { placeToken } from '@/lib/now/liveBusyness';
import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';
import { POST } from '../now/place/route';

const place = { id: 'ven_abc123', name: 'Proof', address: '1 Main St', lat: 41.2565, lng: -95.9345 };
const request = (body: unknown) => new Request('http://localhost/api/now/place', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.50' },
  body: JSON.stringify(body),
});

afterEach(() => { vi.unstubAllEnvs(); placeDetails.mockClear(); resetNowRateLimitsForTests(); });

it('is members only', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'g');
  member.current = new Response('no', { status: 401 });
  expect((await POST(request({ ...place, token: placeToken(place) }))).status).toBe(401);
  expect(placeDetails).not.toHaveBeenCalled();
});

it('only looks up a place exactly as the map showed it', async () => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
  vi.stubEnv('GOOGLE_PLACES_API_KEY', 'g');
  member.current = { id: 'member', email: null };
  const token = placeToken(place);
  // Same id, another name: the token no longer fits, so Google is never asked.
  expect((await POST(request({ ...place, name: 'Somewhere else', token }))).status).toBe(403);
  expect(placeDetails).not.toHaveBeenCalled();
  const ok = await POST(request({ ...place, token }));
  expect(ok.status).toBe(200);
  expect((await ok.json()).place.type).toBe('Cocktail bar');
});

it('without a Google key the card still works, with no details', async () => {
  vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
  member.current = { id: 'member', email: null };
  expect(await (await POST(request(place))).json()).toEqual({ place: null });
});
