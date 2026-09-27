import { NextResponse } from 'next/server';
import {
  NowProviderBudgetExceededError,
  NowProviderBudgetUnavailableError,
  NowSearchBudgetError,
} from '@/lib/now/providerBudget';
import { dailyCalls, memberCharge } from '@/lib/now/liveBusyness';
import { consumeNowClientRateLimit } from '@/lib/now/rateLimit';
import { executeNow } from '@/lib/now/service';
import { validateNowRequest } from '@/lib/now/validation';
import { NO_STORE, RequestTooLargeError, jsonError, readBodyWithLimit, validateRequestBoundary } from '@/lib/now/http';
import { requireMember } from '@/lib/platform/server/member';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Members only: this route spends money or runs a search.
  const member = await requireMember(request);
  if (member instanceof Response) return member;
  const boundaryFailure = validateRequestBoundary(request);
  if (boundaryFailure) return boundaryFailure;

  if (!process.env.BESTTIME_API_KEY_PRIVATE) {
    return jsonError(
      503,
      'NOW_PROVIDER_NOT_CONFIGURED',
      'NOW venue intelligence is not configured yet.',
    );
  }

  // Per member: one person's requests never count against another's.
  const clientLimit = consumeNowClientRateLimit(request, Date.now(), { scope: 'now', who: member.id });
  if (!clientLimit.allowed) {
    return jsonError(
      429,
      'NOW_RATE_LIMITED',
      'Too many NOW requests. Wait a few minutes and try again.',
      { 'Retry-After': String(clientLimit.retryAfterSeconds) },
    );
  }

  try {
    const raw = await readBodyWithLimit(request);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'INVALID_NOW_REQUEST', 'Request body must be valid JSON.');
    }

    const input = validateNowRequest(body);
    // The member's own daily share of venue searches (the same pool as the map's), spent only on an uncached search.
    const result = await executeNow(input, memberCharge(member.id, 'nowM', dailyCalls('BESTTIME_SEARCH_MEMBER_DAILY_CALLS', 60)));
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) {
      return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
    }
    if (cause instanceof NowSearchBudgetError) {
      return jsonError(
        429,
        'NOW_DAILY_LIMIT',
        cause.scope === 'member'
          ? 'You’ve used today’s NOW searches. More open up tomorrow.'
          : 'NOW searches are at today’s limit. Try again tomorrow.',
        { 'Retry-After': String(cause.retryAfterSeconds) },
      );
    }
    if (cause instanceof NowProviderBudgetExceededError) {
      return jsonError(
        429,
        'NOW_RATE_LIMITED',
        'NOW is temporarily at capacity. Wait a few minutes and try again.',
        { 'Retry-After': String(cause.retryAfterSeconds) },
      );
    }
    if (cause instanceof NowProviderBudgetUnavailableError) {
      return jsonError(
        503,
        'NOW_BUDGET_UNAVAILABLE',
        'NOW provider accounting is unavailable, so paid venue intelligence is paused.',
      );
    }

    const message = cause instanceof Error ? cause.message : 'NOW could not complete this request.';
    const validation =
      message.includes('must be') ||
      message.startsWith('Choose a valid') ||
      message.startsWith('Request body') ||
      message.startsWith('Each interest');
    return jsonError(
      validation ? 400 : 502,
      validation ? 'INVALID_NOW_REQUEST' : 'NOW_PROVIDER_ERROR',
      validation ? message : 'NOW could not retrieve venue intelligence. Try again shortly.',
    );
  }
}
