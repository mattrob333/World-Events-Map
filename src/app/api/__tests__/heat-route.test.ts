import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// The news library is unavailable in tests: Heat must still work from Wikipedia and say so.
vi.mock('@/lib/vibe/server/feedIndex', () => ({ feedIndex: async () => ({ byPlace: new Map(), status: { state: 'unavailable', since: null, stories: 0 } }) }));

import { GET } from '../heat/route';

const fetchMock = vi.fn();

function series(url: string) {
  const [, from, to] = url.match(/daily\/(\d{8})\/(\d{8})$/)!;
  const start = Date.parse(`${from.slice(0, 4)}-${from.slice(4, 6)}-${from.slice(6)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 4)}-${to.slice(4, 6)}-${to.slice(6)}T00:00:00Z`);
  const surging = url.includes('Oktoberfest');
  const items = [];
  for (let t = start, i = 0; t <= end; t += 86_400_000, i += 1) {
    const late = end - t < 7 * 86_400_000;
    const d = new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
    items.push({ timestamp: `${d}00`, views: surging ? (late ? 12_000 : 2_900) : 800 });
  }
  return items;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-25T12:00:00Z'));
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/dope\.travel/);
    return new Response(JSON.stringify({ items: series(String(url)) }), { status: 200 });
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('GET /api/heat', () => {
  it('returns only what made the cut, hottest first, with its source named', async () => {
    const response = await GET(new Request('http://localhost/api/heat?limit=5'));
    const body = await response.json();
    expect(response.headers.get('Cache-Control')).toMatch(/s-maxage=3600/);
    expect(body.sources.news).toBe('unavailable');
    expect(body.items[0].subjectId).toBe('event:oktoberfest-munich');
    expect(body.items[0].direction).toBe('up');
    expect(body.items[0].headline.sourceLabel).toBe('Wikipedia views (en)');
    // Flat, small articles don't make the cut.
    expect(body.items.every((item: { madeCut: boolean }) => item.madeCut)).toBe(true);
    expect(body.items).toHaveLength(1);
  });

  it('filters to one country and rejects junk', async () => {
    const jp = await (await GET(new Request('http://localhost/api/heat?country=JP'))).json();
    expect(jp.items.every((item: { countryCode: string }) => item.countryCode === 'JP')).toBe(true);
    expect((await GET(new Request('http://localhost/api/heat?country=Japan'))).status).toBe(400);
  });
});
