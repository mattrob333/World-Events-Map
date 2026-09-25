import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/jev/receipts', () => ({ storeReceipts: vi.fn(async () => {}) }));

import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { POST as postBasket } from '../designer/basket/route';
import { POST as postRoute } from '../designer/route-trip/route';

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.7' },
    body: JSON.stringify(body),
  });
}

const saved = process.env.TYPESAFE_API_KEY;
beforeEach(() => { delete process.env.TYPESAFE_API_KEY; resetDesignerLimitsForTests(); });
afterEach(() => { if (saved === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = saved; vi.unstubAllGlobals(); });

describe('route-trip', () => {
  it('recommends destinations from the curated calendar for "best ski spot"', async () => {
    const response = await postRoute(request('/api/designer/route-trip', { text: 'what is the best ski spot right now?', today: '2026-12-01' }));
    const body = await response.json();
    expect(body.route).toBe('recommend');
    expect(body.tripType).toBe('ski');
    expect(body.decidedBy).toBe('rules');
    expect(body.recommendations.length).toBeGreaterThan(0);
    expect(body.recommendations[0]).toHaveProperty('when');
  });

  it('plans a named place and asks when there is nothing to go on', async () => {
    expect(await (await postRoute(request('/api/designer/route-trip', { text: 'Lisbon in October, me and Sam' }))).json()).toMatchObject({ route: 'plan', place: { place: 'Lisbon' } });
    expect(await (await postRoute(request('/api/designer/route-trip', { text: 'hmm hello' }))).json()).toMatchObject({ route: 'follow_up' });
  });

  it('never treats a spoken question as a place (red team 09-25)', async () => {
    const route = async (text: string) => (await (await postRoute(request('/api/designer/route-trip', { text, today: '2026-09-25' }))).json()) as { route: string; place?: unknown };
    for (const text of ["where's the best surf town", 'best ski spot right now', 'recommend a beach', 'best food city', 'Surprise me', 'I don\'t know yet somewhere fun with the kids in December', 'Take me skiing in January', 'We need a break next month', 'Plan my honeymoon', 'where should I go for my honeymoon in December']) {
      const body = await route(text);
      expect(body.route, text).not.toBe('plan');
    }
    expect((await route('somewhere warm')).route).toBe('recommend');
  });

  it('plans from speech with no commas and carries the dates said', async () => {
    const body = await (await postRoute(request('/api/designer/route-trip', { text: 'Lisbon second week of October me and Sam no touristy fado', today: '2026-09-25' }))).json();
    expect(body).toMatchObject({ route: 'plan', place: { place: 'Lisbon', start: '2026-10-08' } });
    const japan = await (await postRoute(request('/api/designer/route-trip', { text: 'I want to go to Japan for a week in February', today: '2026-09-25' }))).json();
    expect(japan).toMatchObject({ route: 'plan', place: { place: 'Japan', start: '2027-02-01', nights: 7 } });
  });

  it('keeps recommendations inside a month that was named', async () => {
    const body = await (await postRoute(request('/api/designer/route-trip', { text: 'somewhere to ski in January', today: '2026-09-25' }))).json() as { route: string; month: string; recommendations: { start: string; end: string }[] };
    expect(body.route).toBe('recommend');
    expect(body.month).toBe('2027-01');
    for (const rec of body.recommendations) expect(rec.start <= '2027-01-31' && (rec.start >= '2027-01-01' || rec.end >= '2027-01-07')).toBe(true);
  });

  it('uses Jev when configured and keeps code in charge of the route', async () => {
    process.env.TYPESAFE_API_KEY = 'test';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      model: 'jev-latest',
      answers: {
        intent: { type: 'choice', probabilities: { recommend_destination: 0.9, plan_trip: 0.05, find_specific: 0.02, question: 0.02, unclear: 0.01 }, confidence: 0.9 },
        trip_type: { type: 'choice', probabilities: Object.fromEntries([...['ski', 'surf', 'beach', 'city', 'food', 'nightlife', 'music', 'festivals', 'sports', 'luxury', 'family', 'adventure', 'outdoors', 'culture', 'wellness', 'road-trip', 'cruise', 'deals', 'points', 'business'].map((t) => [t, t === 'food' ? 0.81 : 0.01]), ['none', 0]]), confidence: 0.8 },
        ready_to_plan: { type: 'noul', noul: 0.4 },
      },
    }), { status: 200 })));
    const body = await (await postRoute(request('/api/designer/route-trip', { text: 'where should we eat our way through this fall?', today: '2026-09-24' }))).json();
    expect(body).toMatchObject({ route: 'recommend', tripType: 'food', decidedBy: 'jev' });
  });
});

describe('basket', () => {
  const candidates = [
    { id: 'a', name: 'Sushi Place', kind: 'food', category: 'Omakase', rating: 4.9, source: 'Google Maps' },
    { id: 'b', name: 'Grill', kind: 'food', rating: 4.5, source: 'Yelp' },
    { id: 'bad', name: '<script>', kind: 'food', source: 'Yelp' },
  ];
  it('ranks by rating and says so when Jev is not configured', async () => {
    const body = await (await postBasket(request('/api/designer/basket', { trip: { place: 'Tokyo' }, traveler: { likes: ['omakase'] }, candidates }))).json();
    expect(body.rankedBy).toBe('rating');
    expect(body.note).toMatch(/ranked by rating/);
    expect(body.ranked.map((c: { id: string }) => c.id)).toEqual(['a', 'b', 'bad']);
    expect(body.ranked[2].name).toBe('script');
    expect(body.ranked[0].because).toBe('Matches your likes: omakase');
  });
  it('refuses to rank with nothing fetched or no place', async () => {
    expect((await postBasket(request('/api/designer/basket', { trip: { place: 'Tokyo' }, candidates: [] }))).status).toBe(400);
    expect((await postBasket(request('/api/designer/basket', { trip: {}, candidates }))).status).toBe(400);
  });
});
