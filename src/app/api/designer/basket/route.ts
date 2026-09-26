import { RequestTooLargeError, checkBoundary, consumeProviderCall, jsonError, jsonOk, readJson } from '@/lib/designer/server/guard';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { askJev, jevConfigured, stateHash, type ScoreAnswer } from '@/lib/jev/client';
import { FIT_BATCH, TRIP_FIT_CONTRACT, rankCandidates, tripFitQuestions, tripFitState, type FitCandidate, type FitContext } from '@/lib/jev/contracts/tripFit';
import { storeReceipts } from '@/lib/jev/receipts';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_CANDIDATES = FIT_BATCH * 2;
const clean = (value: unknown, max: number): string | undefined =>
  typeof value === 'string' && value.trim() ? value.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').replace(/[<>{}\\]/g, '').trim().slice(0, max) || undefined : undefined;
const num = (value: unknown, lo: number, hi: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= lo && value <= hi ? value : undefined;

function candidate(raw: unknown): FitCandidate | null {
  const c = raw as Record<string, unknown> | null;
  if (!c || typeof c !== 'object') return null;
  const id = typeof c.id === 'string' && /^[A-Za-z0-9:_./-]{1,80}$/.test(c.id) ? c.id : null;
  const name = clean(c.name, 80);
  const kind = clean(c.kind, 20);
  const source = clean(c.source, 30);
  if (!id || !name || !kind || !source) return null;
  return { id, name, kind, source, category: clean(c.category, 60), rating: num(c.rating, 0, 5), reviews: num(c.reviews, 0, 10_000_000), price: clean(c.price, 12), snippet: clean(c.snippet, 200) };
}

/**
 * The candidate basket: rank real listings the traveler already fetched
 * (Maps, Yelp, Tripadvisor) for this traveler and trip with trip-fit@1. Jev
 * only orders what the providers returned; without Jev the list comes back
 * ranked by rating and says so.
 */
export async function POST(request: Request) {
  // Members only: this route spends money or runs a search.
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundary = checkBoundary(request);
  if (boundary) return boundary;
  let body: Record<string, unknown>;
  try {
    body = ((await readJson(request, 40_000)) ?? {}) as Record<string, unknown>;
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'TOO_LARGE', 'That request is too large.');
    return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }
  const seen = new Set<string>();
  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .map(candidate)
    .filter((c): c is FitCandidate => c !== null && !seen.has(c.id) && Boolean(seen.add(c.id)))
    .slice(0, MAX_CANDIDATES);
  if (candidates.length < 2) return jsonError(400, 'TOO_FEW', 'Look around first, so there are places to rank.');

  const trip = (body.trip ?? {}) as Record<string, unknown>;
  const traveler = (body.traveler ?? {}) as Record<string, unknown>;
  const place = clean(trip.place, 80);
  if (!place) return jsonError(400, 'NO_PLACE', 'The trip needs a place.');
  const context: FitContext = {
    traveler: clean(traveler.words, 600) ?? '',
    likes: (Array.isArray(traveler.likes) ? traveler.likes : []).map((like) => clean(like, 40)).filter((like): like is string => Boolean(like)).slice(0, 24),
    trip: { place, when: clean(trip.when, 60), crew: clean(trip.crew, 120), mustDo: clean(trip.mustDo, 200), notDoing: clean(trip.notDoing, 200), tripType: clean(trip.tripType, 20) ?? null },
  };

  const batches: FitCandidate[][] = [];
  for (let i = 0; i < candidates.length; i += FIT_BATCH) batches.push(candidates.slice(i, i + FIT_BATCH));
  if (!jevConfigured()) {
    return jsonOk({ ...rankCandidates(candidates, null, context.likes), note: 'The fit check isn’t connected, so these are ranked by rating.' });
  }
  if (!consumeProviderCall(request, 'jev', Date.now(), batches.length) || !(await takeShared('jev', batches.length))) {
    return jsonOk({ ...rankCandidates(candidates, null, context.likes), note: 'Fit check is busy right now, so these are ranked by rating.' });
  }

  const answers: Record<string, ScoreAnswer> = {};
  let failed = false;
  const receipts = await Promise.all(batches.map(async (batch) => {
    const state = tripFitState(context, batch);
    const result = await askJev(state, tripFitQuestions(batch));
    if (result.ok) Object.assign(answers, result.answers);
    else failed = true;
    return {
      contract: TRIP_FIT_CONTRACT, subject: place, stateHash: stateHash(state), model: result.ok ? result.model : null,
      latencyMs: result.latencyMs, answers: result.ok ? (result.answers as never) : null, failure: result.ok ? null : result.failure,
      route: result.ok ? 'ranked' : 'rating_fallback', actionTaken: true, createdAt: new Date().toISOString(),
    };
  }));
  void storeReceipts(receipts);
  const ranked = rankCandidates(candidates, failed ? null : answers, context.likes);
  return jsonOk({ ...ranked, note: ranked.rankedBy === 'rating' ? 'The fit check isn’t available, so these are ranked by rating.' : null });
}
