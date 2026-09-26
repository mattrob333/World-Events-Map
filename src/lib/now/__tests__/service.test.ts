import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  judge: vi.fn(),
  budget: vi.fn(),
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

vi.mock('../providerBudget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../providerBudget')>();
  return {
    ...actual,
    requireNowProviderBudget: mocks.budget,
  };
});

import { executeNow, resetNowVenueCacheForTests } from '../service';
import type { NowRequest } from '../types';

beforeEach(() => {
  mocks.budget.mockResolvedValue({
    allowed: true,
    retry_after_seconds: 0,
    remaining: 119,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  mocks.search.mockReset();
  mocks.judge.mockReset();
  mocks.budget.mockReset();
  resetNowVenueCacheForTests();
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

describe('executeNow venue cache and provider budget', () => {
  it('reuses provider facts but recomputes distance for each precise origin', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    mocks.search.mockResolvedValue([fixtureVenue()]);

    const first = await executeNow(request(40.7501));
    const second = await executeNow(request(40.7504));

    expect(mocks.search).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
    const firstDistance = first.picks[0]?.candidate.distanceMeters;
    const secondDistance = second.picks[0]?.candidate.distanceMeters;
    expect(firstDistance).toBeDefined();
    expect(secondDistance).toBeDefined();
    expect(firstDistance).not.toBe(99999);
    expect(secondDistance).not.toBe(99999);
    expect(secondDistance).not.toBe(firstDistance);
  });

  it('does not claim durable paid-provider budget for cache-only reads', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', '');
    mocks.search.mockResolvedValue([fixtureVenue()]);

    await executeNow(request(40.7501));
    for (let index = 0; index < 20; index += 1) {
      await executeNow(request(40.7501));
    }

    expect(mocks.search).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(1);
  });

  it('claims separate durable budget for BestTime and TypeSafe calls', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    mocks.search.mockResolvedValue([
      fixtureVenue(),
      { ...fixtureVenue(), id: 'venue-2', name: 'Second Bar', location: { lat: 40.751, lng: -73.981 } },
    ]);
    mocks.judge.mockImplementation(async (input: { candidates: { id: string }[] }) =>
      input.candidates.map((candidate) => ({
        candidateId: candidate.id,
        score: 80,
        confidence: 0.8,
        reasons: ['Context fit'],
      })),
    );

    await executeNow(request(40.75));

    expect(mocks.search).toHaveBeenCalledTimes(1);
    expect(mocks.judge).toHaveBeenCalledTimes(1);
    expect(mocks.budget).toHaveBeenCalledTimes(2);
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
    expect(mocks.budget).toHaveBeenCalledTimes(2);
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

describe('drinks: bars filed as restaurants', () => {
  it('runs a second, budgeted search for them and merges without doubles', async () => {
    resetNowVenueCacheForTests();
    mocks.budget.mockClear();
    mocks.search.mockReset();
    const bar = { id: 'bar-1', name: 'Mercury', category: 'BAR', location: { lat: 41.26, lng: -95.93 } };
    const tap = { id: 'tap-1', name: 'Omaha Tap House', category: 'RESTAURANT', location: { lat: 41.26, lng: -95.93 } };
    mocks.search.mockImplementation(async (input: { categories: string[] }) => (input.categories[0] === 'drinks' ? [bar] : [tap, bar]));
    const { venueCandidates } = await import('../service');
    const venues = await venueCandidates({ location: { lat: 41.26, lng: -95.93 }, radiusMeters: 1609, intent: 'drinks', barsFiledAsRestaurants: true });
    expect(venues.map((venue) => venue.id)).toEqual(['bar-1', 'tap-1']);
    expect(mocks.search).toHaveBeenCalledTimes(2);
    expect(mocks.search.mock.calls[1][0]).toMatchObject({ categories: ['drinksrestaurants'], limit: 20 });
    expect(mocks.budget).toHaveBeenCalledTimes(2);
  });

  it('keeps the bars when the extra search is out of budget', async () => {
    resetNowVenueCacheForTests();
    mocks.search.mockReset();
    mocks.budget.mockReset();
    mocks.budget.mockResolvedValueOnce({ allowed: true, retry_after_seconds: 0, remaining: 1 }).mockRejectedValueOnce(new Error('budget'));
    mocks.search.mockResolvedValue([{ id: 'bar-2', name: 'Proof', category: 'BAR', location: { lat: 41.26, lng: -95.93 } }]);
    const { venueCandidates } = await import('../service');
    const venues = await venueCandidates({ location: { lat: 41.2, lng: -95.9 }, radiusMeters: 1609, intent: 'drinks', barsFiledAsRestaurants: true });
    expect(venues.map((venue) => venue.id)).toEqual(['bar-2']);
    expect(mocks.search).toHaveBeenCalledTimes(1);
  });
});
