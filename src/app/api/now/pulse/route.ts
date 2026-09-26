import { NextResponse } from 'next/server';
import { NO_STORE, RequestTooLargeError, jsonError, readBodyWithLimit, validateRequestBoundary } from '@/lib/now/http';
import { NowProviderBudgetExceededError, NowProviderBudgetUnavailableError } from '@/lib/now/providerBudget';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { executePulse } from '@/lib/now/pulseService';
import { PULSE_RADIUS_METERS, PULSE_WHATS, type PulseWhat } from '@/lib/now/pulse';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Vibe Now: the busiest places within five miles, from BestTime foot traffic.
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
  const clientLimit = consumeNowClientRateLimit(request);
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
    const radius = typeof raw.radiusMeters === 'number' && Number.isFinite(raw.radiusMeters) ? Math.max(800, Math.min(PULSE_RADIUS_METERS, Math.round(raw.radiusMeters))) : PULSE_RADIUS_METERS;
    return NextResponse.json(await executePulse({ lat, lng }, what, radius), { headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
    if (cause instanceof NowProviderBudgetExceededError) {
      return jsonError(429, 'NOW_RATE_LIMITED', 'Foot traffic is at capacity right now. Try again in a few minutes.', { 'Retry-After': String(cause.retryAfterSeconds) });
    }
    if (cause instanceof NowProviderBudgetUnavailableError) {
      return jsonError(503, 'NOW_BUDGET_UNAVAILABLE', 'Foot traffic is paused while its spending guard is unavailable.');
    }
    return jsonError(502, 'NOW_PROVIDER_ERROR', 'Foot traffic could not be checked. Try again shortly.');
  }
}
