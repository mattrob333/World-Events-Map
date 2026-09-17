import { describe, expect, it } from 'vitest';
import type { VenueCandidate } from '@/lib/opportunities';
import { rankNowCandidates, selectNowPicks } from '../engine';
import type { NowRequest } from '../types';

const request: NowRequest = {
  location: { lat: 40.75, lng: -73.98 },
  intent: 'drinks',
  vibe: 'social',
  radiusMeters: 5000,
  availableMinutes: 180,
  maxPriceLevel: 3,
  minRating: 4,
  partySize: 2,
};

function venue(
  id: string,
  overrides: Partial<VenueCandidate> = {},
): VenueCandidate {
  return {
    id,
    provider: 'fixture',
    name: id,
    category: 'cocktail bar',
    location: { lat: 40.75, lng: -73.98 },
    openNow: true,
    distanceMeters: 900,
    rating: 4.6,
    reviewCount: 1200,
    priceLevel: 2,
    expectedBusyness: 62,
    dwellMinutes: 90,
    ...overrides,
  };
}

describe('NOW decision engine', () => {
  it('removes impossible candidates before scoring', () => {
    const scored = rankNowCandidates({
      request,
      candidates: [
        venue('good'),
        venue('closed', { openNow: false }),
        venue('too-far', { distanceMeters: 8000 }),
        venue('too-expensive', { priceLevel: 4 }),
        venue('too-long', { dwellMinutes: 240 }),
        venue('low-rating', { rating: 3.5 }),
      ],
    });

    expect(scored.map((item) => item.candidate.id)).toEqual(['good']);
  });

  it('uses structured judgment as a bounded boost rather than replacing facts', () => {
    const scored = rankNowCandidates({
      request,
      candidates: [
        venue('near', { distanceMeters: 250, expectedBusyness: 60 }),
        venue('far', { distanceMeters: 4500, expectedBusyness: 60 }),
      ],
      judgments: [
        {
          candidateId: 'far',
          score: 100,
          confidence: 0.9,
          reasons: ['Strong contextual fit'],
        },
      ],
    });

    const far = scored.find((item) => item.candidate.id === 'far');
    expect(far?.dimensions.judgment).toBe(100);
    expect(far?.reasons).toContain('Strong contextual fit');
    expect(far?.score).toBeLessThan(100);
  });

  it('returns distinct Best Match, Most Alive and Wildcard picks', () => {
    const scored = rankNowCandidates({
      request,
      candidates: [
        venue('balanced', { expectedBusyness: 60, distanceMeters: 300 }),
        venue('packed', { expectedBusyness: 96, distanceMeters: 1500 }),
        venue('wine', {
          category: 'wine bar',
          expectedBusyness: 55,
          distanceMeters: 800,
        }),
        venue('gallery', {
          category: 'gallery bar',
          expectedBusyness: 48,
          distanceMeters: 950,
          rating: 4.8,
        }),
      ],
    });

    const picks = selectNowPicks(scored);
    expect(picks).toHaveLength(3);
    expect(picks.map((pick) => pick.label)).toEqual([
      'best_match',
      'most_alive',
      'wildcard',
    ]);
    expect(new Set(picks.map((pick) => pick.candidate.id)).size).toBe(3);
  });

  it('does not fabricate busyness when the provider did not return it', () => {
    const scored = rankNowCandidates({
      request,
      candidates: [
        venue('unknown-traffic', {
          expectedBusyness: undefined,
          liveBusyness: undefined,
        }),
      ],
    });

    expect(scored[0]?.reasons.some((reason) => reason.includes('%'))).toBe(false);
  });
});
