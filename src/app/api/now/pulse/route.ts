import { NextResponse } from 'next/server';
import { NO_STORE, RequestTooLargeError, jsonError, readBodyWithLimit, validateRequestBoundary } from '@/lib/now/http';
import { NowProviderBudgetExceededError, NowProviderBudgetUnavailableError, NowSearchBudgetError } from '@/lib/now/providerBudget';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { placesMemberCharge, withGoogleHours } from '@/lib/now/googlePlaces';
import { executePulse } from '@/lib/now/pulseService';
import { PULSE_WHATS, roundForSearch, snapPulseRadius, type PulseWhat } from '@/lib/now/pulse';
import { bestTimeDay, hourlyForArea } from '@/lib/now/hourly';
import { requireMember } from '@/lib/platform/server/member';
import { dailyCalls, liveToken, memberCharge, placeToken } from '@/lib/now/liveBusyness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vibe Now: the busiest places within 2, 5 or 10 miles, from BestTime foot
 * traffic, with tonight's closing times (BestTime's, else Google Places).
 * The phone sends a point rounded to about a kilometer; nothing is stored.
 */
export async function POST(request: Request) {
  // Members only: this route spends money or runs a search.
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundaryFailure = validateRequestBoundary(request);
  if (boundaryFailure) return boundaryFailure;
  if (!process.env.BESTTIME_API_KEY_PRIVATE) {
    return jsonError(503, 'NOW_PROVIDER_NOT_CONFIGURED', 'Foot traffic is not connected yet.');
  }
  // Per member, like the live checks: one person's refreshes never count against another's.
  const clientLimit = consumeNowClientRateLimit(request, Date.now(), { scope: 'pulse', who: member.id });
  if (!clientLimit.allowed) {
    return jsonError(429, 'NOW_RATE_LIMITED', 'Too many requests. Wait a few minutes and try again.', { 'Retry-After': String(clientLimit.retryAfterSeconds) });
  }
  try {
    let body: unknown;
    try {
      body = JSON.parse(await readBodyWithLimit(request));
    } catch (cause) {
      if (cause instanceof RequestTooLargeError) throw cause;
      return jsonError(400, 'INVALID_NOW_REQUEST', 'Request body must be valid JSON.');
    }
    const point = (body && typeof body === 'object' ? (body as Record<string, unknown>).location : null) as Record<string, unknown> | null;
    const lat = typeof point?.lat === 'number' && Number.isFinite(point.lat) ? point.lat : NaN;
    const lng = typeof point?.lng === 'number' && Number.isFinite(point.lng) ? point.lng : NaN;
    if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) {
      return jsonError(400, 'INVALID_NOW_REQUEST', 'A location with latitude and longitude is required.');
    }
    const raw = body as Record<string, unknown>;
    const what: PulseWhat = PULSE_WHATS.includes(raw.what as PulseWhat) ? (raw.what as PulseWhat) : 'surprise';
    // Only the map's own radii (plus the phone's slack): any other number would be a fresh, paid search.
    const radius = snapPulseRadius(raw.radiusMeters);
    // The member's own daily share of venue searches, taken only when a search really goes out (cached areas are free).
    const searches = memberCharge(member.id, 'nowM', dailyCalls('BESTTIME_SEARCH_MEMBER_DAILY_CALLS', 60));
    // The phone's own weekday (0 = Monday) and hour pick BestTime's day for the hourly chart; nothing else uses them.
    const clock = raw.clock && typeof raw.clock === 'object' ? (raw.clock as Record<string, unknown>) : null;
    const weekday = typeof clock?.day === 'number' && Number.isInteger(clock.day) && clock.day >= 0 && clock.day <= 6 ? clock.day : null;
    const hour = typeof clock?.hour === 'number' && Number.isInteger(clock.hour) && clock.hour >= 0 && clock.hour <= 23 ? clock.hour : null;
    const [result, hourly] = await Promise.all([
      executePulse({ lat, lng }, what, radius, searches),
      weekday !== null && hour !== null ? hourlyForArea(roundForSearch({ lat, lng }), radius, what, bestTimeDay(weekday, hour), searches) : Promise.resolve(null),
    ]);
    // Closing times BestTime didn't have come from Google Places (within the member's own share and the site's daily cap).
    const venues = (await withGoogleHours(result.venues, new Date(), placesMemberCharge(member.id))).map((venue) => {
      const day = hourly?.get(venue.id);
      return { ...venue, ...(day ? { hourly: day } : {}), liveToken: liveToken(venue.id), placeToken: placeToken({ id: venue.id, name: venue.name, address: venue.address, lat: venue.lat, lng: venue.lng }) };
    });
    return NextResponse.json({ ...result, venues }, { headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
    if (cause instanceof NowSearchBudgetError) {
      const text = cause.scope === 'member' ? 'You’ve used today’s foot-traffic searches. Areas you’ve already loaded still show; more open up tomorrow.' : 'Foot-traffic searches are at today’s limit. Try again tomorrow.';
      return jsonError(429, 'NOW_DAILY_LIMIT', text, { 'Retry-After': String(cause.retryAfterSeconds) });
    }
    if (cause instanceof NowProviderBudgetExceededError) {
      return jsonError(429, 'NOW_RATE_LIMITED', 'Foot traffic is at capacity right now. Try again in a few minutes.', { 'Retry-After': String(cause.retryAfterSeconds) });
    }
    if (cause instanceof NowProviderBudgetUnavailableError) {
      return jsonError(503, 'NOW_BUDGET_UNAVAILABLE', 'Foot traffic is paused while its spending guard is unavailable.');
    }
    return jsonError(502, 'NOW_PROVIDER_ERROR', 'Foot traffic could not be checked. Try again shortly.');
  }
}
