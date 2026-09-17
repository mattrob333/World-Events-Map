import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { parseBestTimeVenue } from '../besttime';

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

describe('parseBestTimeVenue', () => {
  it('maps current-hour opening data without claiming minute-level precision', () => {
    const open = parseBestTimeVenue(fixture(), origin, 20);
    const closed = parseBestTimeVenue(fixture(), origin, 3);

    expect(open?.openNow).toBe(true);
    expect(closed?.openNow).toBe(false);
    expect(open?.expectedBusyness).toBe(72);
    expect(open?.metadata?.openStatusResolution).toBe('current-hour');
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

    expect(parseBestTimeVenue(overnight, origin, 23)?.openNow).toBe(true);
    expect(parseBestTimeVenue(overnight, origin, 1)?.openNow).toBe(true);
    expect(parseBestTimeVenue(overnight, origin, 12)?.openNow).toBe(false);
  });

  it('leaves open status unknown when the source omits a usable schedule', () => {
    const parsed = parseBestTimeVenue(
      fixture({ day_info: { venue_open_close_v2: { '24h': [{ note: 'unknown' }] } } }),
      origin,
      20,
    );

    expect(parsed?.openNow).toBeUndefined();
  });
});
