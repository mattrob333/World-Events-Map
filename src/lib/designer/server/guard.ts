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

const LOOPBACK = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

function originOf(value: string | undefined, assumeHttps = false): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(assumeHttps && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw).origin;
  } catch {
    return null;
  }
}

/**
 * The origins the app is actually served from, from configuration only:
 * NEXT_PUBLIC_SITE_URL, plus the deployment, branch and production URLs that
 * Vercel sets on its own builds. Never derived from the request's Host or
 * X-Forwarded-* headers, which any caller can set.
 */
export function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const add = (origin: string | null) => origin && origins.add(origin);
  add(originOf(process.env.NEXT_PUBLIC_SITE_URL));
  // Other hosts that serve this app, e.g. "https://www.example.com,https://example.vercel.app" (review S4).
  for (const extra of (process.env.EXTRA_ALLOWED_ORIGINS ?? '').split(',')) add(originOf(extra.trim()));
  if (process.env.VERCEL) {
    add(originOf(process.env.VERCEL_URL, true));
    add(originOf(process.env.VERCEL_BRANCH_URL, true));
    add(originOf(process.env.VERCEL_PROJECT_PRODUCTION_URL, true));
  }
  return origins;
}

/**
 * Loopback origins (any port) are allowed in development and off Vercel
 * (`next dev` on 3100, `next start` on 3127/3128). A web page on another
 * site can't claim a loopback Origin, so this opens nothing to browsers; a
 * non-browser client can send any Origin anyway, which is why the daily
 * budgets, not this check, are the real cost control.
 */
function loopbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' || !process.env.VERCEL;
}

export function originAllowed(origin: string): boolean {
  if (!origin || origin === 'null') return false;
  if (allowedOrigins().has(origin)) return true;
  return loopbackAllowed() && LOOPBACK.test(origin);
}

/** Same-origin JSON only: the designer routes are not a public AI proxy. */
export function checkBoundary(request: Request): Response | null {
  const mediaType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') {
    return jsonError(415, 'JSON_REQUIRED', 'Send application/json from the dope.travel app.');
  }
  const origin = originOf(request.headers.get('origin') ?? undefined) ?? '';
  const fetchSite = request.headers.get('sec-fetch-site');
  if (!originAllowed(origin) || (fetchSite && fetchSite !== 'same-origin')) {
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
export type LimitName = 'ai' | 'concerts' | 'jev' | 'spotify' | 'research' | 'mcp' | 'voice';
/** Per client per 10 minutes. `research` counts only cache misses; `mcp` counts JSON-RPC messages. */
const LIMITS: Record<LimitName, number> = { ai: AI_CALLS_PER_WINDOW, concerts: 20, jev: 10, spotify: 10, research: 4, mcp: 240, voice: 8 };
const buckets = new Map<string, Bucket>();

/** Key when the client can't be identified: everyone shares one bucket (conservative, never per-caller). */
export const SHARED_CLIENT_KEY = 'shared';

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/** Expand an IPv6 address to eight hextets, or null when it isn't one. */
function ipv6Hextets(value: string): string[] | null {
  let ip = value.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase();
  const v4 = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    if (!IPV4.test(v4[2])) return null;
    const [a, b, c, d] = v4[2].split('.').map(Number);
    ip = `${v4[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  if (!/^[0-9a-f:]+$/.test(ip) || (ip.match(/::/g)?.length ?? 0) > 1) return null;
  const [head, tail] = ip.includes('::') ? ip.split('::') : [ip, undefined];
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = 8 - left.length - right.length;
  if (tail === undefined ? left.length !== 8 : missing < 1) return null;
  const all = [...left, ...Array(tail === undefined ? 0 : missing).fill('0'), ...right];
  if (all.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return all.map((part) => part.padStart(4, '0'));
}

/**
 * Normalize a client IP into a limiter key: IPv4 as is, IPv4-mapped IPv6 as
 * IPv4, and other IPv6 by its /64 (one household or phone usually holds a
 * whole /64, so per-address keys are free to rotate). Null when invalid.
 */
export function ipKey(value: string | null | undefined): string | null {
  const raw = value?.split(',')[0]?.trim();
  if (!raw) return null;
  if (IPV4.test(raw)) return raw;
  const hextets = ipv6Hextets(raw);
  if (!hextets) return null;
  if (hextets.slice(0, 5).every((h) => h === '0000') && hextets[5] === 'ffff') {
    const n = parseInt(hextets[6], 16);
    const m = parseInt(hextets[7], 16);
    return `${n >> 8}.${n & 255}.${m >> 8}.${m & 255}`;
  }
  return `${hextets.slice(0, 4).join(':')}::/64`;
}

/**
 * Who is calling, for the per-client limiter. Client IP headers are trusted
 * only where a trusted proxy sets them:
 * - On Vercel (`VERCEL` is set), the edge overwrites `x-real-ip` and
 *   `x-forwarded-for` with the real client address, so callers can't mint
 *   identities by sending their own.
 * - Elsewhere, only the header named in `TRUSTED_CLIENT_IP_HEADER` (set it only
 *   behind a proxy that overwrites that header), else one shared key.
 * `x-vercel-forwarded-for` is never read off Vercel: the red team minted
 * 100 identities with it on a `next start` deployment.
 */
export function clientKey(request: Request): string {
  const headers = request.headers;
  if (process.env.VERCEL) {
    return ipKey(headers.get('x-real-ip')) ?? ipKey(headers.get('x-forwarded-for')) ?? ipKey(headers.get('x-vercel-forwarded-for')) ?? SHARED_CLIENT_KEY;
  }
  const trusted = process.env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (trusted && /^[a-z0-9-]{1,64}$/.test(trusted)) return ipKey(headers.get(trusted)) ?? SHARED_CLIENT_KEY;
  return SHARED_CLIENT_KEY;
}

/**
 * Warm-instance guard on paid provider calls. When it trips, routes fall back
 * to free alternatives (on-device composer, search links) instead of failing.
 * It is per instance, not a durable budget: the daily caps in dailyBudget.ts
 * bound total spend. `units` lets one request count as several (MCP batches).
 */
export function consumeProviderCall(request: Request, name: LimitName, now = Date.now(), units = 1): boolean {
  const key = `${name}|${clientKey(request)}`;
  if (!buckets.has(key) && buckets.size >= MAX_TRACKED_CLIENTS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (oldest) buckets.delete(oldest);
  }
  const current = buckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + WINDOW_MS };
  if (bucket.count + units > LIMITS[name]) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.count += units;
  buckets.set(key, bucket);
  return true;
}

export function consumeAiCall(request: Request, now = Date.now()): boolean {
  return consumeProviderCall(request, 'ai', now);
}

export function resetDesignerLimitsForTests() {
  buckets.clear();
}
