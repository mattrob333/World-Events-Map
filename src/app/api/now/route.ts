import { NextResponse } from 'next/server';
import {
  consumeNowClientRateLimit,
  consumeNowProviderBudget,
} from '@/lib/now/rateLimit';
import { executeNow } from '@/lib/now/service';
import { validateNowRequest } from '@/lib/now/validation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_BODY_BYTES = 20_000;
const NO_STORE = { 'Cache-Control': 'no-store' };

class RequestTooLargeError extends Error {}

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

async function readBodyWithLimit(request: Request): Promise<string> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new RequestTooLargeError('NOW request body is too large.');
  }

  if (!request.body) return '';

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestTooLargeError('NOW request body is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  if (!process.env.BESTTIME_API_KEY_PRIVATE) {
    return jsonError(
      503,
      'NOW_PROVIDER_NOT_CONFIGURED',
      'NOW venue intelligence is not configured yet.',
    );
  }

  const clientLimit = consumeNowClientRateLimit(request);
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

    // Charge the shared provider-work budget only after the request is proven
    // valid and is about to execute paid external work.
    const providerBudget = consumeNowProviderBudget();
    if (!providerBudget.allowed) {
      return jsonError(
        429,
        'NOW_RATE_LIMITED',
        'NOW is temporarily at capacity. Wait a few minutes and try again.',
        { 'Retry-After': String(providerBudget.retryAfterSeconds) },
      );
    }

    const result = await executeNow(input);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) {
      return jsonError(413, 'NOW_REQUEST_TOO_LARGE', cause.message);
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
