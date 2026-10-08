import { NextResponse } from 'next/server';
import { NO_STORE, RequestTooLargeError, jsonError, readBodyWithLimit, validateRequestBoundary } from '@/lib/now/http';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { findWhere, normalQuery, whereMemberCharge } from '@/lib/now/where';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vibe Now: find where they'll be (a hotel, an address) so they can plan the
 * night before they get there. Members only; a short burst limit, then each
 * member's daily share and the site's daily Places budget. The search text is
 * not logged or kept; the place they pick is saved on their device only.
 */
export async function POST(request: Request) {
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundaryFailure = validateRequestBoundary(request);
  if (boundaryFailure) return boundaryFailure;
  if (!process.env.GOOGLE_PLACES_API_KEY) return jsonError(503, 'WHERE_NOT_CONFIGURED', 'Address search isn’t available right now.');
  const limit = consumeNowClientRateLimit(request, Date.now(), { scope: 'where', who: member.id, limit: 10 });
  if (!limit.allowed) return jsonError(429, 'NOW_RATE_LIMITED', 'Too many searches. Wait a few minutes and try again.', { 'Retry-After': String(limit.retryAfterSeconds) });
  let raw: Record<string, unknown>;
  try {
    raw = (JSON.parse(await readBodyWithLimit(request)) as Record<string, unknown>) ?? {};
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
    return jsonError(400, 'INVALID_NOW_REQUEST', 'Request body must be valid JSON.');
  }
  const query = normalQuery(raw.query);
  if (query.length < 3) return jsonError(400, 'INVALID_NOW_REQUEST', 'Type a hotel name or an address.');
  const result = await findWhere(query, process.env.GOOGLE_PLACES_API_KEY, whereMemberCharge(member.id));
  if (result.reason === 'budget') return jsonError(429, 'WHERE_DAILY_LIMIT', 'You’ve used today’s address searches. Try again tomorrow.');
  if (result.reason === 'unavailable') return jsonError(502, 'WHERE_UNAVAILABLE', 'Address search couldn’t be reached. Try again shortly.');
  return NextResponse.json({ places: result.places }, { headers: NO_STORE });
}
