import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/designer/server/sharedBudget', () => ({ takeShared: vi.fn(async () => true) }));

const { withGoogleHours } = await import('../googlePlaces');
import type { PulseVenue } from '../pulse';

const venue = (id: string, extra: Partial<PulseVenue> = {}): PulseVenue => ({ id, name: id, category: 'BAR', lat: 41.26, lng: -95.93, busyness: 50, basis: 'forecast', ...extra });
// Friday 22:00 in Omaha = Saturday 03:00 UTC.
const NOW = new Date('2026-09-26T03:00:00Z');

describe('withGoogleHours', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('only looks up places without hours, fills tonight’s close, and drops ones closed now', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).textQuery as string;
      const periods = query.startsWith('open-late')
        ? [{ open: { day: 5, hour: 16, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }]
        : [{ open: { day: 5, hour: 11, minute: 0 }, close: { day: 5, hour: 21, minute: 0 } }];
      return new Response(JSON.stringify({ places: [{ currentOpeningHours: { periods }, utcOffsetMinutes: -300, googleMapsUri: 'https://maps.google.com/?cid=1' }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await withGoogleHours([venue('has-hours', { closesMinutes: 1500 }), venue('open-late'), venue('closed-now')], NOW);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(out.map((v) => [v.id, v.closesMinutes, v.hoursFrom])).toEqual([['has-hours', 1500, 'besttime'], ['open-late', 1560, 'google']]);
    expect(out[1].mapsUrl).toBe('https://maps.google.com/?cid=1');
  });

  it('without a key it only marks BestTime hours', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const out = await withGoogleHours([venue('a', { closesMinutes: 1500 }), venue('b')], NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.map((v) => v.hoursFrom)).toEqual(['besttime', undefined]);
  });
});
