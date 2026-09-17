import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  judge: vi.fn(),
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
    judge = mocks.judge;
  },
}));

import {
  consumeNowProviderBudget,
  resetNowRateLimitsForTests,
} from '../rateLimit';
import { executeNow, resetNowVenueCacheForTests } from '../service';
import type { NowRequest } from '../types';

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.search.mockReset();
  mocks.judge.mockReset();
  resetNowVenueCacheForTests();
  resetNowRateLimitsForTests();
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

function fixtureVenue() {
  return {
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
  };
}

describe('executeNow venue cache', () => {
  it('reuses provider facts but recomputes distance for each precise origin', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    mocks.search.mockResolvedValue([fixtureVenue()]);

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

  it('does not charge the shared paid-provider budget for cache-only reads', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    mocks.search.mockResolvedValue([fixtureVenue()]);

    await executeNow(request(40.7501));
    for (let index = 0; index < 20; index += 1) {
      await executeNow(request(40.7501));
    }

    expect(mocks.search).toHaveBeenCalledTimes(1);

    // The first cache miss consumed one of 120 provider-call slots. Cache hits
    // consumed none, so exactly 119 additional claims remain available.
    for (let index = 0; index < 119; index += 1) {
      expect(consumeNowProviderBudget(1_000).allowed).toBe(true);
    }
    expect(consumeNowProviderBudget(1_000).allowed).toBe(false);
  });

  it('never lets an unevaluated candidate outrank the TypeSafe shortlist', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');

    const venues = Array.from({ length: 13 }, (_, index) => ({
      id: `venue-${String(index + 1).padStart(2, '0')}`,
      provider: 'besttime',
      name: `Venue ${String(index + 1).padStart(2, '0')}`,
      category: 'BAR',
      location: { lat: 40.7505, lng: -73.98 },
      openNow: true,
      rating: 4.8,
      reviewCount: 1000,
      priceLevel: 2,
      expectedBusyness: 62,
      dwellMinutes: 90,
    }));
    mocks.search.mockResolvedValue(venues);
    mocks.judge.mockImplementation(async (input: { candidates: { id: string }[] }) =>
      input.candidates.map((candidate) => ({
        candidateId: candidate.id,
        score: 0,
        confidence: 1,
        reasons: ['Context downgrade'],
      })),
    );

    const result = await executeNow(request(40.75));

    expect(result.candidateCount).toBe(13);
    expect(mocks.judge).toHaveBeenCalledTimes(1);
    const judgedIds = new Set(
      (mocks.judge.mock.calls[0]?.[0] as { candidates: { id: string }[] }).candidates.map(
        (candidate) => candidate.id,
      ),
    );
    expect(judgedIds.size).toBe(12);
    expect(result.picks.every((pick) => judgedIds.has(pick.candidate.id))).toBe(true);
    expect(result.picks.some((pick) => pick.candidate.id === 'venue-13')).toBe(false);
  });
});
