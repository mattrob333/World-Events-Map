import { NextResponse } from 'next/server';
import { placeDetails } from '@/lib/now/googlePlaces';
import { NO_STORE, RequestTooLargeError, jsonError, readBodyWithLimit, validateRequestBoundary } from '@/lib/now/http';
import { takeSharedNamed } from '@/lib/designer/server/sharedBudget';
import { memberPool, validPlaceToken, validVenueId, type SignedPlace } from '@/lib/now/liveBusyness';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vibe Now: Google's facts for one place a member tapped (type, rating,
 * price, website, phone, tonight's hours). Only places the pulse returned,
 * exactly as it returned them; members only; one lookup per place per 12
 * hours within the daily Google Places budget.
 */
export async function POST(request: Request) {
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundaryFailure = validateRequestBoundary(request);
  if (boundaryFailure) return boundaryFailure;
  // No Google key: the card still works from BestTime alone.
  if (!process.env.GOOGLE_PLACES_API_KEY) return NextResponse.json({ place: null }, { headers: NO_STORE });
  const limit = consumeNowClientRateLimit(request, Date.now(), { scope: 'place', who: member.id, limit: 30 });
  if (!limit.allowed) return jsonError(429, 'NOW_RATE_LIMITED', 'Too many requests. Wait a few minutes and try again.', { 'Retry-After': String(limit.retryAfterSeconds) });
  let raw: Record<string, unknown>;
  try {
    raw = (JSON.parse(await readBodyWithLimit(request)) as Record<string, unknown>) ?? {};
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
    return jsonError(400, 'INVALID_NOW_REQUEST', 'Request body must be valid JSON.');
  }
  const place: SignedPlace = {
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : '',
    ...(typeof raw.address === 'string' ? { address: raw.address.slice(0, 140) } : {}),
    lat: typeof raw.lat === 'number' ? raw.lat : NaN,
    lng: typeof raw.lng === 'number' ? raw.lng : NaN,
  };
  if (!validVenueId(place.id) || !place.name || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) return jsonError(400, 'INVALID_NOW_REQUEST', 'A place is required.');
  if (!validPlaceToken(place, raw.token)) return jsonError(403, 'NOW_PLACE_UNKNOWN', 'Refresh the map, then tap the place again.');
  try {
    // Each member's own daily share of Google lookups (places already looked up cost nothing),
    // so no one can spend the site's budget and switch off closing times for everyone.
    const raw = Number(process.env.GOOGLE_PLACES_MEMBER_DAILY_CALLS);
    const cap = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
    const charge = () => takeSharedNamed(memberPool(member.id, 'plcM'), cap);
    return NextResponse.json({ place: await placeDetails(place, new Date(), charge) }, { headers: NO_STORE });
  } catch {
    return NextResponse.json({ place: null }, { headers: NO_STORE });
  }
}
