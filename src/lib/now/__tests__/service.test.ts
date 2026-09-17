import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock('@/lib/opportunities/besttime', () => ({
  BestTimeVenueProvider: class {
    readonly id = 'besttime';
    search = mocks.search;
  },
}));

vi.mock('@/lib/opportunities/typesafe', () => ({
  TypeSafeJudgmentProvider: class {
    readonly id = 'typesafe-jev';
    judge = vi.fn();
  },
}));

import { executeNow } from '../service';
import type { NowRequest } from '../types';

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.search.mockReset();
});

function request(lat: number): NowRequest {
  return {
    location: { lat, lng: -73.98 },
    intent: 'drinks',
    vibe: 'social',
    radiusMeters: 3000,
    minRating: 4,
  };
}

describe('executeNow venue cache', () => {
  it('reuses provider facts but recomputes distance for each precise origin', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    mocks.search.mockResolvedValue([
      {
        id: 'venue-1',
        provider: 'besttime',
        name: 'Cache Test Bar',
        category: 'BAR',
        location: { lat: 40.7509, lng: -73.98 },
        openNow: true,
        distanceMeters: 99999,
        rating: 4.7,
        reviewCount: 500,
        priceLevel: 2,
        expectedBusyness: 65,
        dwellMinutes: 90,
      },
    ]);

    const first = await executeNow(request(40.7501));
    const second = await executeNow(request(40.7504));

    expect(mocks.search).toHaveBeenCalledTimes(1);
    const firstDistance = first.picks[0]?.candidate.distanceMeters;
    const secondDistance = second.picks[0]?.candidate.distanceMeters;
    expect(firstDistance).toBeDefined();
    expect(secondDistance).toBeDefined();
    expect(firstDistance).not.toBe(99999);
    expect(secondDistance).not.toBe(99999);
    expect(secondDistance).not.toBe(firstDistance);
  });
});
