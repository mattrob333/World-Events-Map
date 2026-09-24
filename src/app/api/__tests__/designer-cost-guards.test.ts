import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resetDailyBudgetsForTests } from '@/lib/designer/server/dailyBudget';
import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { resetResearchCacheForTests } from '@/lib/research/destination';
import { POST as postConcerts } from '../designer/concerts/route';
import { POST as postPersona } from '../designer/persona/route';
import { POST as postResearch } from '../designer/research/route';
import { POST as postScene } from '../designer/scene/route';

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3100${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3100', 'Sec-Fetch-Site': 'same-origin', ...headers },
    body: JSON.stringify(body),
  });
}

/** Treg double: Google Maps answers with one sight; everything else is empty. No real calls. */
function fakeTreg() {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.startsWith('https://www.tiktok.com/oembed')) return new Response('{}');
    const endpoint = new URL(url).pathname.replace('/call/', '');
    calls.push(endpoint);
    const body = endpoint === 'anyapi.google.serp.maps'
      ? { output: { found: true, data: { items: [{ name: 'Ryman Auditorium', placeId: 'ChIJryman', url: 'https://www.google.com/maps/place/x', rating: 4.8, reviewCount: 900, latitude: 36.16, longitude: -86.77 }] } } }
      : {};
    return new Response(JSON.stringify(body), { status: 200, headers: { 'x-treg-cost-micro': '1000' } });
  });
  return { calls, fetchImpl };
}

beforeEach(() => {
  vi.stubEnv('VERCEL', '');
  resetDesignerLimitsForTests();
  resetDailyBudgetsForTests();
  resetResearchCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('POST /api/designer/research limiter', () => {
  it('never 429s reopening a cached place, and only fresh research spends limiter tokens', async () => {
    vi.stubEnv('TREG_TOKEN', 'test-token');
    const { calls, fetchImpl } = fakeTreg();
    vi.stubGlobal('fetch', fetchImpl);
    const nashville = { name: 'Nashville', region: 'Tennessee', scene: 'Rock cover bands' };
    const guestCopy = { name: 'Nashville', region: 'Tennessee' }; // invite links strip taste
    expect((await postResearch(request('/api/designer/research', nashville))).status).toBe(200);
    const organizerCalls = calls.length;
    // The guest's first open only adds the default nightlife search (one limiter token, one paid call).
    expect((await postResearch(request('/api/designer/research', guestCopy))).status).toBe(200);
    expect(calls.length).toBe(organizerCalls + 1);
    const paid = calls.length;
    // Six reopenings (organizer refresh, guests) in ten minutes: all served, none paid, no tokens spent.
    for (let i = 0; i < 6; i += 1) {
      const response = await postResearch(request('/api/designer/research', i % 2 ? nashville : guestCopy));
      expect(response.status).toBe(200);
      expect((await response.json()).topSpots.status).toBe('ok');
    }
    expect(calls.length).toBe(paid);
    // Fresh places still spend the per-client limit (4 per 10 minutes; two used above).
    const statuses = [];
    for (const name of ['Memphis', 'Austin', 'Denver']) statuses.push((await postResearch(request('/api/designer/research', { name }))).status);
    expect(statuses).toEqual([200, 200, 429]);
    // …and a cached place still loads after the limit is hit.
    expect((await postResearch(request('/api/designer/research', nashville))).status).toBe(200);
  });

  it('refuses a forged Origin/Host pair before any paid work', async () => {
    vi.stubEnv('TREG_TOKEN', 'test-token');
    const { calls, fetchImpl } = fakeTreg();
    vi.stubGlobal('fetch', fetchImpl);
    const forged = new Request('https://evil.example/api/designer/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example', Host: 'evil.example' },
      body: JSON.stringify({ name: 'Lisbon' }),
    });
    expect((await postResearch(forged)).status).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe('Jev and event-feed daily budgets', () => {
  it('stops Jev persona calls when today’s Jev budget is spent, and says so', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    vi.stubEnv('JEV_DESIGNER_DAILY_CALLS', '0');
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    const body = await (await postPersona(request('/api/designer/persona', { taste: { genres: ['rock'] } }))).json();
    expect(body).toEqual({ persona: null, reason: 'daily_limit' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('counts every event-feed request and falls back to search links when the day is spent', async () => {
    vi.stubEnv('TICKETMASTER_API_KEY', 'tm');
    vi.stubEnv('SEATGEEK_CLIENT_ID', '');
    vi.stubEnv('TYPESAFE_API_KEY', '');
    vi.stubEnv('EVENT_FEED_DAILY_CALLS', '10');
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ _embedded: { events: [] } })));
    vi.stubGlobal('fetch', fetchImpl);
    const artists = ['A1', 'A2', 'A3', 'A4', 'A5'];
    // 5 artists × (tour + tribute) = 10 Ticketmaster requests: exactly today's budget.
    const first = await (await postConcerts(request('/api/designer/concerts', { artists }))).json();
    expect(first.source).toBe('ticketmaster');
    expect(fetchImpl).toHaveBeenCalledTimes(10);
    const second = await (await postConcerts(request('/api/designer/concerts', { artists: ['A1'] }))).json();
    expect(second).toMatchObject({ source: 'links', sources: [], concerts: [] });
    expect(second.links.length).toBeGreaterThan(0);
    const scene = await (await postScene(request('/api/designer/scene', { city: 'Nashville', taste: { genres: ['classic rock'] } }))).json();
    expect(scene.sources).toEqual([]);
    expect(scene.scenes.length).toBeGreaterThan(0);
    expect(fetchImpl).toHaveBeenCalledTimes(10);
  });
});
