import { NextResponse } from 'next/server';

/** Request guards shared by the NOW routes: same-origin JSON only, with a body cap. */

export const MAX_BODY_BYTES = 20_000;
export const NO_STORE = { 'Cache-Control': 'no-store' };

export class RequestTooLargeError extends Error {}

export function jsonError(
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

function expectedOrigin(request: Request): string {
  const url = new URL(request.url);
  const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    url.host;
  return `${protocol}://${host}`;
}

export function validateRequestBoundary(request: Request): Response | null {
  const mediaType = request.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLocaleLowerCase();
  if (mediaType !== 'application/json') {
    return jsonError(
      415,
      'NOW_JSON_REQUIRED',
      'NOW accepts same-origin application/json requests only.',
    );
  }

  const origin = request.headers.get('origin');
  let normalizedOrigin = '';
  if (origin) {
    try {
      normalizedOrigin = new URL(origin).origin;
    } catch {
      normalizedOrigin = '';
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site');
  const sameOrigin = normalizedOrigin === expectedOrigin(request);
  const browserSaysSameOrigin = fetchSite === 'same-origin';
  if (!sameOrigin || (fetchSite && !browserSaysSameOrigin)) {
    return jsonError(
      403,
      'NOW_SAME_ORIGIN_REQUIRED',
      'NOW requests must come from the dope.travel app.',
    );
  }

  return null;
}

export async function readBodyWithLimit(request: Request): Promise<string> {
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
