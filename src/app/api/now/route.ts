import { NextResponse } from 'next/server';
import { consumeNowRateLimit } from '@/lib/now/rateLimit';
import { executeNow } from '@/lib/now/service';
import { validateNowRequest } from '@/lib/now/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_CHARS = 20_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

function jsonError(
  status: number,
  code: string,
  error: string,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(
    { error, code },
    { status, headers: { ...NO_STORE, ...headers } },
  );
}

export async function POST(request: Request) {
  if (!process.env.BESTTIME_API_KEY_PRIVATE) {
    return jsonError(
      503,
      'NOW_PROVIDER_NOT_CONFIGURED',
      'NOW venue intelligence is not configured yet.',
    );
  }

  const limit = consumeNowRateLimit(request);
  if (!limit.allowed) {
    return jsonError(
      429,
      'NOW_RATE_LIMITED',
      'Too many NOW requests. Wait a few minutes and try again.',
      { 'Retry-After': String(limit.retryAfterSeconds) },
    );
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_CHARS) {
    return jsonError(413, 'NOW_REQUEST_TOO_LARGE', 'NOW request body is too large.');
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) {
      return jsonError(413, 'NOW_REQUEST_TOO_LARGE', 'NOW request body is too large.');
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError(400, 'INVALID_NOW_REQUEST', 'Request body must be valid JSON.');
    }

    const input = validateNowRequest(body);
    const result = await executeNow(input);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (cause) {
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
