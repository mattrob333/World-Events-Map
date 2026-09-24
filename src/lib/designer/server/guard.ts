import 'server-only';
import { NextResponse } from 'next/server';

const NO_STORE = { 'Cache-Control': 'no-store' };
const WINDOW_MS = 10 * 60 * 1000;
const AI_CALLS_PER_WINDOW = 8;
const MAX_TRACKED_CLIENTS = 5000;

export class RequestTooLargeError extends Error {}

export function jsonError(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status, headers: NO_STORE });
}

export function jsonOk(body: unknown) {
  return NextResponse.json(body, { headers: NO_STORE });
}

function expectedOrigin(request: Request): string {
  const url = new URL(request.url);
  const protocol = request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host;
  return `${protocol}://${host}`;
}

/** Same-origin JSON only: the designer routes are not a public AI proxy. */
export function checkBoundary(request: Request): Response | null {
  const mediaType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return jsonError(415, 'JSON_REQUIRED', 'Send application/json from the dope.travel app.');
  }
  let origin = '';
  try {
    origin = new URL(request.headers.get('origin') ?? '').origin;
  } catch {
    origin = '';
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin !== expectedOrigin(request) || (fetchSite && fetchSite !== 'same-origin')) {
    return jsonError(403, 'SAME_ORIGIN_REQUIRED', 'Designer requests must come from the dope.travel app.');
  }
  return null;
}

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestTooLargeError('Request is too large.');
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new RequestTooLargeError('Request is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text);
}

type Bucket = { count: number; resetAt: number };
type LimitName = 'ai' | 'concerts' | 'jev' | 'spotify';
const LIMITS: Record<LimitName, number> = { ai: AI_CALLS_PER_WINDOW, concerts: 20, jev: 10, spotify: 10 };
const buckets = new Map<string, Bucket>();

function clientKey(request: Request): string {
  // Prefer the platform-set header so callers cannot mint limiter identities
  // with their own X-Forwarded-For.
  const vercel = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const real = request.headers.get('x-real-ip')?.trim();
  return (vercel || real || 'anonymous').slice(0, 128);
}

/**
 * Warm-instance guard on paid provider calls. When it trips, routes fall back
 * to free alternatives (on-device composer, search links) instead of failing.
 * It is per instance, not a durable budget; a durable spend cap is required
 * before public launch.
 */
export function consumeProviderCall(request: Request, name: LimitName, now = Date.now()): boolean {
  const key = `${name}|${clientKey(request)}`;
  if (!buckets.has(key) && buckets.size >= MAX_TRACKED_CLIENTS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (oldest) buckets.delete(oldest);
  }
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + WINDOW_MS };
  if (bucket.count >= LIMITS[name]) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return true;
}

export function consumeAiCall(request: Request, now = Date.now()): boolean {
  return consumeProviderCall(request, 'ai', now);
}

export function resetDesignerLimitsForTests() {
  buckets.clear();
}
