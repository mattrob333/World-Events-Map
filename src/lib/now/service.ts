import 'server-only';

import { BestTimeVenueProvider } from '@/lib/opportunities/besttime';
import { TypeSafeJudgmentProvider } from '@/lib/opportunities/typesafe';
import type { CandidateJudgment, GeoPoint, JudgmentInput, VenueCandidate } from '@/lib/opportunities';
import { rankNowCandidates, selectNowPicks } from './engine';
import {
  NowProviderBudgetExceededError,
  NowProviderBudgetUnavailableError,
  requireNowProviderBudget,
} from './providerBudget';
import type { NowRequest, NowResult } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const venueCache = new Map<string, { expiresAt: number; venues: VenueCandidate[] }>();

export function resetNowVenueCacheForTests() {
  venueCache.clear();
}

type VenueQuery = Pick<NowRequest, 'location' | 'radiusMeters' | 'intent'> & { limit?: number };

function cacheKey(request: VenueQuery): string {
  return [
    request.location.lat.toFixed(3),
    request.location.lng.toFixed(3),
    request.radiusMeters,
    request.intent,
    request.limit ?? 24,
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

export async function venueCandidates(request: VenueQuery): Promise<VenueCandidate[]> {
  const key = cacheKey(request);
  const now = Date.now();
  const cached = venueCache.get(key);
  if (cached && cached.expiresAt > now) {
    return distancesForOrigin(cached.venues, request.location);
  }
  if (cached) venueCache.delete(key);

  // This is the point at which dope.travel is actually about to make a paid
  // external request. The claim is atomic in shared Postgres, so serverless
  // scale-out cannot mint additional provider budget. Cache hits above are free.
  await requireNowProviderBudget();
  const provider = new BestTimeVenueProvider();
  const venues = await provider.search({
    location: request.location,
    radiusMeters: request.radiusMeters,
    at: new Date(now).toISOString(),
    categories: [request.intent],
    limit: request.limit ?? 24,
  });
  pruneVenueCache(now);
  venueCache.set(key, { expiresAt: now + CACHE_TTL_MS, venues });
  return distancesForOrigin(venues, request.location);
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

export async function executeNow(request: NowRequest): Promise<NowResult> {
  const warnings: string[] = [];
  const candidates = await venueCandidates(request);
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
