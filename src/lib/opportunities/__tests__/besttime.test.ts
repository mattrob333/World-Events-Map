import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { BestTimeVenueProvider, closingMinutes, parseBestTimeVenue } from '../besttime';

const origin = { lat: 40.75, lng: -73.98 };

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    venue_id: 'venue-1',
    venue_name: 'Night Owl',
    venue_type: 'BAR',
    venue_lat: 40.751,
    venue_lng: -73.979,
    venue_address: '123 Test St',
    rating: 4.7,
    reviews: 900,
    price_level: 2,
    day_raw: [72],
    venue_dwell_time_min: 60,
    venue_dwell_time_max: 120,
    day_info: {
      venue_open_close_v2: {
        '24h': [
          {
            opens: 18,
            opens_minutes: 0,
            closes: 23,
            closes_minutes: 30,
            crosses_midnight: false,
          },
        ],
      },
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseBestTimeVenue', () => {
  it('maps current-hour opening data without claiming minute-level precision', () => {
    const open = parseBestTimeVenue(fixture(), origin, 20, 0);
    const closed = parseBestTimeVenue(fixture(), origin, 3, 0);

    expect(open?.openNow).toBe(true);
    expect(closed?.openNow).toBe(false);
    expect(open?.expectedBusyness).toBe(72);
    expect(open?.metadata?.openStatusResolution).toBe('current-hour');
  });

  it('uses BestTime time_local_index if a wider traffic array is returned', () => {
    const parsed = parseBestTimeVenue(
      fixture({ day_raw: [5, 12, 28, 67, 90] }),
      origin,
      20,
      3,
    );

    expect(parsed?.expectedBusyness).toBe(67);
  });

  it('does not guess a current sample from a wider array without a valid provider index', () => {
    const parsed = parseBestTimeVenue(
      fixture({ day_raw: [5, 12, 28, 67, 90] }),
      origin,
      20,
    );

    expect(parsed?.expectedBusyness).toBeUndefined();
  });

  it('honors the day-level 24-hour flag', () => {
    const parsed = parseBestTimeVenue(
      fixture({
        day_info: {
          venue_open_close_v2: {
            open_24h: true,
            '24h': [],
          },
        },
      }),
      origin,
      3,
      0,
    );

    expect(parsed?.openNow).toBe(true);
  });

  it('handles opening periods that cross midnight', () => {
    const overnight = fixture({
      day_info: {
        venue_open_close_v2: {
          '24h': [
            {
              opens: 22,
              opens_minutes: 0,
              closes: 2,
              closes_minutes: 0,
              crosses_midnight: true,
            },
          ],
        },
      },
    });

    expect(parseBestTimeVenue(overnight, origin, 23, 0)?.openNow).toBe(true);
    expect(parseBestTimeVenue(overnight, origin, 1, 0)?.openNow).toBe(true);
    expect(parseBestTimeVenue(overnight, origin, 12, 0)?.openNow).toBe(false);
  });

  it('treats a venue closing at the start of the hour as closed for that hour', () => {
    const closesAtEleven = fixture({
      day_info: {
        venue_open_close_v2: {
          '24h': [
            {
              opens: 18,
              opens_minutes: 0,
              closes: 23,
              closes_minutes: 0,
              crosses_midnight: false,
            },
          ],
        },
      },
    });

    expect(parseBestTimeVenue(closesAtEleven, origin, 23, 0)?.openNow).toBe(false);
  });

  it('leaves open status unknown when the source omits a usable schedule', () => {
    const parsed = parseBestTimeVenue(
      fixture({ day_info: { venue_open_close_v2: { '24h': [{ note: 'unknown' }] } } }),
      origin,
      20,
      0,
    );

    expect(parsed?.openNow).toBeUndefined();
  });
});

describe('BestTimeVenueProvider', () => {
  it('treats a malformed venues container as provider failure, not an empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'OK', venues: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const provider = new BestTimeVenueProvider('private-key');
    await expect(
      provider.search({
        location: origin,
        radiusMeters: 3000,
        at: '2026-09-17T20:00:00.000Z',
        categories: ['drinks'],
      }),
    ).rejects.toThrow(/invalid venue container/i);
  });

  it('accepts a valid empty venues array as a truthful empty result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'OK', venues: [], window: { time_local: 20 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const provider = new BestTimeVenueProvider('private-key');
    await expect(
      provider.search({
        location: origin,
        radiusMeters: 3000,
        at: '2026-09-17T20:00:00.000Z',
        categories: ['drinks'],
      }),
    ).resolves.toEqual([]);
  });
});

describe('closingMinutes', () => {
  const venue = (periods: unknown[]) => ({ day_info: { venue_open_close_v2: { '24h': periods } } });
  it('runs past midnight for a bar that closes at 2am', () => {
    const bar = venue([{ opens: 17, closes: 2, crosses_midnight: true }]);
    expect(closingMinutes(bar, 22)).toBe(1560);
    expect(closingMinutes(bar, 1)).toBe(1560);
    expect(closingMinutes(bar, 11)).toBeUndefined();
  });
  it('reads a same-day close with minutes', () => {
    expect(closingMinutes(venue([{ opens: 11, closes: 22, closes_minutes: 30 }]), 20)).toBe(22 * 60 + 30);
  });
});

describe('drinks includes bars filed as restaurants', () => {
  it('keeps a tap house or pub filed as a restaurant, and leaves out plain restaurants', async () => {
    const { drinksPlace } = await import('../besttime');
    expect(drinksPlace({ category: 'RESTAURANT', name: 'Omaha Tap House - Downtown' })).toBe(true);
    expect(drinksPlace({ category: 'RESTAURANT', name: "Dinker's Bar and Grill" })).toBe(true);
    expect(drinksPlace({ category: 'RESTAURANT', name: 'Upstream Brewing Company' })).toBe(true);
    expect(drinksPlace({ category: 'RESTAURANT', name: 'Twisted Fork' })).toBe(false);
    expect(drinksPlace({ category: 'BAR', name: 'Mercury' })).toBe(true);
  });
});

describe('drinks names that mean food', () => {
  it('leaves out barbecue, sushi, oyster and salad bars', async () => {
    const { drinksPlace } = await import('../besttime');
    for (const name of ["Joe's Bar-B-Q", 'Sushi Bar Kaito', 'Oyster Bar', 'Salad Bar Co', "Brewster's Diner", 'Famous Dave’s BBQ Bar']) {
      expect(drinksPlace({ category: 'RESTAURANT', name }), name).toBe(false);
    }
    expect(drinksPlace({ category: 'RESTAURANT', name: 'Lucky Bucket Brewpub' })).toBe(true);
  });
});

describe('parseDayForecast', () => {
  it('turns a 6am-first BestTime day into clock hours and skips anything that isn’t a whole day', async () => {
    const { parseDayForecast } = await import('../besttime');
    const day = Array.from({ length: 24 }, (_, i) => i * 4); // 6am = 0, 5am next day = 92
    const out = parseDayForecast({ status: 'OK', venues: [
      { venue_id: 'ven_full', day_int: 4, day_raw: day },
      { venue_id: 'ven_short', day_int: 4, day_raw: [50] },
      { venue_id: 'ven_other_day', day_int: 3, day_raw: day },
      { venue_id: 'ven_bad', day_int: 4, day_raw: [...day.slice(0, 23), 'x'] },
    ] }, 4);
    expect([...out.hourly.keys()]).toEqual(['ven_full']);
    const hours = out.hourly.get('ven_full')!;
    expect(hours[6]).toBe(0);
    expect(hours[22]).toBe(64);
    expect(hours[0]).toBe(72);
    expect(hours[5]).toBe(92);
    expect(out.shape).toEqual({ venues: 4, lengths: { '24': 3, '1': 1 }, dayMatches: 3, dayMismatches: 1 });
  });
});
