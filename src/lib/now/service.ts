import 'server-only';

import { reserveShared } from '@/lib/designer/server/sharedBudget';
import { BestTimeVenueProvider } from '@/lib/opportunities/besttime';
import { TypeSafeJudgmentProvider } from '@/lib/opportunities/typesafe';
import type { CandidateJudgment, GeoPoint, JudgmentInput, VenueCandidate } from '@/lib/opportunities';
import { rankNowCandidates, selectNowPicks } from './engine';
import type { MemberCharge } from './liveBusyness';
import {
  NowProviderBudgetExceededError,
  NowProviderBudgetUnavailableError,
  NowSearchBudgetError,
  requireNowProviderBudget,
} from './providerBudget';
import type { NowRequest, NowResult } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const venueCache = new Map<string, { expiresAt: number; venues: VenueCandidate[] }>();
/** Identical searches at once share one paid call. */
const pending = new Map<string, Promise<VenueCandidate[]>>();

export function resetNowVenueCacheForTests() {
  venueCache.clear();
  pending.clear();
}

/**
 * Every budget one BestTime venue search needs, or none: the member's own
 * daily share (when asked on a member's behalf), the site's daily searches,
 * then the per-minute provider budget. A later refusal gives back what was
 * already taken, so a search that never ran costs nothing.
 */
export async function claimVenueSearch(charge?: MemberCharge): Promise<void> {
  if (charge && !(await charge.take())) throw new NowSearchBudgetError('member');
  const daily = await reserveShared(['nowVenue'], 1);
  if (!daily) {
    await charge?.refund();
    throw new NowSearchBudgetError('site');
  }
  try {
    await requireNowProviderBudget();
  } catch (cause) {
    daily.settle(0);
    await charge?.refund();
    throw cause;
  }
  daily.settle(1);
}

type VenueQuery = Pick<NowRequest, 'location' | 'radiusMeters' | 'intent'> & {
  limit?: number;
  /** Vibe Now's Drinks: also look for bars filed as restaurants (one more budgeted search). */
  barsFiledAsRestaurants?: boolean;
};

function cacheKey(request: VenueQuery): string {
  return [
    request.location.lat.toFixed(3),
    request.location.lng.toFixed(3),
    request.radiusMeters,
    request.intent,
    request.limit ?? 24,
    request.barsFiledAsRestaurants ? 'plus' : '',
  ].join(':');
}

function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const root =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(root), Math.sqrt(1 - root)));
}

function distancesForOrigin(venues: VenueCandidate[], origin: GeoPoint): VenueCandidate[] {
  return venues.map((venue) => ({
    ...venue,
    distanceMeters: distanceMeters(origin, venue.location),
  }));
}

function pruneVenueCache(now: number) {
  for (const [key, value] of venueCache) {
    if (value.expiresAt <= now) venueCache.delete(key);
  }
  while (venueCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = venueCache.keys().next().value as string | undefined;
    if (!oldest) break;
    venueCache.delete(oldest);
  }
}

/**
 * BestTime's venues for a search, cached five minutes. Concurrent identical
 * searches share one call, charged to whoever started it; if that caller's
 * own share had run out, the others ask on their own.
 */
export async function venueCandidates(request: VenueQuery, charge?: MemberCharge): Promise<VenueCandidate[]> {
  const key = cacheKey(request);
  for (;;) {
    const cached = venueCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return distancesForOrigin(cached.venues, request.location);
    if (cached) venueCache.delete(key);
    const running = pending.get(key);
    if (!running) break;
    try {
      return distancesForOrigin(await running, request.location);
    } catch (cause) {
      if (!(cause instanceof NowSearchBudgetError && cause.scope === 'member')) throw cause;
    }
  }
  const call = searchVenues(request, key, charge).finally(() => pending.delete(key));
  pending.set(key, call);
  return distancesForOrigin(await call, request.location);
}

async function searchVenues(request: VenueQuery, key: string, charge?: MemberCharge): Promise<VenueCandidate[]> {
  const now = Date.now();
  // This is the point at which dope.travel is actually about to make a paid
  // external request. The claims are atomic in shared Postgres, so serverless
  // scale-out cannot mint additional provider budget. Cache hits above are free.
  await claimVenueSearch(charge);
  const provider = new BestTimeVenueProvider();
  const search = (categories: string[], limit: number) => provider.search({
    location: request.location,
    radiusMeters: request.radiusMeters,
    at: new Date(now).toISOString(),
    categories,
    limit,
  });
  let venues = await search([request.intent], request.limit ?? 24);
  if (request.intent === 'drinks' && request.barsFiledAsRestaurants) {
    // Bars filed as restaurants (tap houses, sports bars): their own small search, so the
    // most-reviewed restaurants never push real bars out of the first one. Budgeted like any call.
    try {
      await claimVenueSearch(charge);
      const barsAsRestaurants = await search(['drinksrestaurants'], 20);
      const seen = new Set(venues.map((venue) => venue.id));
      venues = [...venues, ...barsAsRestaurants.filter((venue) => !seen.has(venue.id))];
    } catch {
      // Out of budget or the extra search failed: the bars from the first search still stand.
    }
  }
  pruneVenueCache(now);
  venueCache.set(key, { expiresAt: now + CACHE_TTL_MS, venues });
  return venues;
}

function judgmentInput(request: NowRequest, candidates: VenueCandidate[]): JudgmentInput {
  return {
    context: {
      intent: request.intent,
      vibe: request.vibe,
      available_minutes: request.availableMinutes,
      party_size: request.partySize,
      travel_mode: request.travelModeName,
      interests: request.interests,
    },
    questions: [
      {
        id: 'activity_fit',
        prompt: "Which candidate best matches the traveler's stated activity intent?",
      },
      {
        id: 'energy_fit',
        prompt: "Which candidate best matches the traveler's requested social energy?",
      },
      {
        id: 'trip_fit',
        prompt: "Which candidate best matches the traveler's trip context and interests?",
      },
    ],
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      facts: {
        name: candidate.name,
        category: candidate.category,
        rating: candidate.rating,
        review_count: candidate.reviewCount,
        price_level: candidate.priceLevel,
        expected_busyness_now: candidate.expectedBusyness,
        live_busyness: candidate.liveBusyness,
        distance_meters: candidate.distanceMeters,
        usual_dwell_minutes: candidate.dwellMinutes,
      },
    })),
  };
}

async function optionalJudgments(
  request: NowRequest,
  shortlist: VenueCandidate[],
  warnings: string[],
): Promise<{ judgments?: CandidateJudgment[]; source: string; degraded: boolean }> {
  // No external judgment is useful for zero/one candidates. Keep this local and
  // preserve paid-provider budget for decisions where a comparison exists.
  if (shortlist.length <= 1) {
    return { source: 'meridian-deterministic', degraded: false };
  }

  if (!process.env.TYPESAFE_API_KEY) {
    warnings.push('Structured judgment is not configured; dope.travel used deterministic ranking.');
    return { source: 'meridian-deterministic', degraded: true };
  }

  try {
    await requireNowProviderBudget();
  } catch (cause) {
    if (
      cause instanceof NowProviderBudgetExceededError ||
      cause instanceof NowProviderBudgetUnavailableError
    ) {
      warnings.push(
        'Structured judgment was skipped because the shared provider budget is unavailable; dope.travel used deterministic ranking.',
      );
      return { source: 'meridian-deterministic', degraded: true };
    }
    throw cause;
  }

  try {
    const provider = new TypeSafeJudgmentProvider();
    return {
      judgments: await provider.judge(judgmentInput(request, shortlist)),
      source: provider.id,
      degraded: false,
    };
  } catch {
    warnings.push('Structured judgment was unavailable; dope.travel fell back to deterministic ranking.');
    return { source: 'meridian-deterministic', degraded: true };
  }
}

export async function executeNow(request: NowRequest, charge?: MemberCharge): Promise<NowResult> {
  const warnings: string[] = [];
  const candidates = await venueCandidates(request, charge);
  const deterministic = rankNowCandidates({ request, candidates });
  const shortlist = deterministic.slice(0, 12).map((item) => item.candidate);
  const judgment = await optionalJudgments(request, shortlist, warnings);

  const ranked = judgment.judgments
    ? rankNowCandidates({ request, candidates: shortlist, judgments: judgment.judgments })
    : deterministic;

  if (deterministic.length === 0) {
    warnings.push('No venue met the current hard constraints. Widen the radius or loosen a filter.');
  }

  return {
    picks: selectNowPicks(ranked),
    candidateCount: deterministic.length,
    venueSource: 'besttime',
    judgmentSource: judgment.source,
    generatedAt: new Date().toISOString(),
    degraded: judgment.degraded,
    warnings,
  };
}
