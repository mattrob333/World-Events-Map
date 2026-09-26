import { NextResponse } from 'next/server';
import { NO_STORE, RequestTooLargeError, jsonError, readBodyWithLimit, validateRequestBoundary } from '@/lib/now/http';
import { LiveBudgetError, liveBusyness, validLiveToken, validVenueId } from '@/lib/now/liveBusyness';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vibe Now: BestTime's live reading for one place the member tapped, so a
 * beam can show its proof (busy right now vs the usual for this hour).
 * Members only, rate limited, one paid lookup per place per five minutes
 * within a daily cap.
 */
export async function POST(request: Request) {
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundaryFailure = validateRequestBoundary(request);
  if (boundaryFailure) return boundaryFailure;
  if (!process.env.BESTTIME_API_KEY_PRIVATE) return jsonError(503, 'NOW_PROVIDER_NOT_CONFIGURED', 'Foot traffic is not connected yet.');
  // Its own bucket, per member: tapping beams never starves the map's own refreshes.
  const limit = consumeNowClientRateLimit(request, Date.now(), { scope: 'live', who: member.id, limit: 30 });
  if (!limit.allowed) return jsonError(429, 'NOW_RATE_LIMITED', 'Too many requests. Wait a few minutes and try again.', { 'Retry-After': String(limit.retryAfterSeconds) });
  let venueId: unknown;
  let token: unknown;
  try {
    ({ venueId, token } = (JSON.parse(await readBodyWithLimit(request)) as { venueId?: unknown; token?: unknown }) ?? {});
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
    return jsonError(400, 'INVALID_NOW_REQUEST', 'Request body must be valid JSON.');
  }
  if (!validVenueId(venueId)) return jsonError(400, 'INVALID_NOW_REQUEST', 'A place id is required.');
  // Only places the pulse actually showed: a made-up id never spends a credit.
  if (!validLiveToken(venueId, token)) return jsonError(403, 'NOW_LIVE_UNKNOWN_PLACE', 'Refresh the map, then tap the place again.');
  try {
    const reading = await liveBusyness(venueId, member.id);
    if (!reading) return jsonError(502, 'NOW_PROVIDER_ERROR', 'The live reading couldn’t be checked. Try again shortly.');
    return NextResponse.json({ reading }, { headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof LiveBudgetError) return jsonError(429, 'NOW_LIVE_BUDGET', `${cause.message} The usual for this hour still shows.`);
    return jsonError(502, 'NOW_PROVIDER_ERROR', 'The live reading couldn’t be checked. Try again shortly.');
  }
}
