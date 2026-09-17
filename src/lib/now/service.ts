import 'server-only';

import { BestTimeVenueProvider } from '@/lib/opportunities/besttime';
import { TypeSafeJudgmentProvider } from '@/lib/opportunities/typesafe';
import type { CandidateJudgment, GeoPoint, JudgmentInput, VenueCandidate } from '@/lib/opportunities';
import { rankNowCandidates, selectNowPicks } from './engine';
import type { NowRequest, NowResult } from './types';

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const venueCache = new Map<string, { expiresAt: number; venues: VenueCandidate[] }>();

function cacheKey(request: NowRequest): string {
  return [
    request.location.lat.toFixed(3),
    request.location.lng.toFixed(3),
    request.radiusMeters,
    request.intent,
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

async function venueCandidates(request: NowRequest): Promise<VenueCandidate[]> {
  const key = cacheKey(request);
  const now = Date.now();
  const cached = venueCache.get(key);
  if (cached && cached.expiresAt > now) {
    return distancesForOrigin(cached.venues, request.location);
  }
  if (cached) venueCache.delete(key);

  const provider = new BestTimeVenueProvider();
  const venues = await provider.search({
    location: request.location,
    radiusMeters: request.radiusMeters,
    at: new Date(now).toISOString(),
    categories: [request.intent],
    limit: 24,
  });
  pruneVenueCache(now);
  // Cache provider facts and venue coordinates, but never trust the cached
  // distance for a second request that merely rounded into the same cell.
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
  if (!process.env.TYPESAFE_API_KEY) {
    warnings.push('Structured judgment is not configured; MERIDIAN used deterministic ranking.');
    return { source: 'meridian-deterministic', degraded: true };
  }

  try {
    const provider = new TypeSafeJudgmentProvider();
    return {
      judgments: await provider.judge(judgmentInput(request, shortlist)),
      source: provider.id,
      degraded: false,
    };
  } catch {
    warnings.push('Structured judgment was unavailable; MERIDIAN fell back to deterministic ranking.');
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
    ? rankNowCandidates({ request, candidates, judgments: judgment.judgments })
    : deterministic;

  if (ranked.length === 0) {
    warnings.push('No venue met the current hard constraints. Widen the radius or loosen a filter.');
  }

  return {
    picks: selectNowPicks(ranked),
    candidateCount: ranked.length,
    venueSource: 'besttime',
    judgmentSource: judgment.source,
    generatedAt: new Date().toISOString(),
    degraded: judgment.degraded,
    warnings,
  };
}
