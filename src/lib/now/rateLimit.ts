const WINDOW_MS = 10 * 60 * 1000;
const PER_CLIENT_LIMIT = 12;
const MAX_TRACKED_CLIENTS = 5000;

type Bucket = {
  count: number;
  resetAt: number;
};

const clientBuckets = new Map<string, Bucket>();

function freshBucket(now: number): Bucket {
  return { count: 0, resetAt: now + WINDOW_MS };
}

function consume(bucket: Bucket, limit: number, now: number) {
  const active = bucket.resetAt > now ? bucket : freshBucket(now);
  if (active.count >= limit) {
    return {
      bucket: active,
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((active.resetAt - now) / 1000)),
    };
  }
  active.count += 1;
  return {
    bucket: active,
    allowed: true,
    retryAfterSeconds: 0,
  };
}

function trustedClientKey(request: Request): string {
  // Vercel documents x-vercel-forwarded-for as the platform-provided public
  // client IP header. Prefer it so a browser caller cannot create arbitrary
  // limiter identities by supplying its own X-Forwarded-For value.
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  const key = vercelForwarded || realIp || 'anonymous';
  return key.slice(0, 128);
}

function ensureClientSlot(key: string) {
  if (clientBuckets.has(key) || clientBuckets.size < MAX_TRACKED_CLIENTS) return;

  // Hard-cap the warm-instance map. Map preserves insertion order, so evict the
  // oldest tracked identity in O(1) rather than scanning thousands of entries.
  const oldestKey = clientBuckets.keys().next().value as string | undefined;
  if (oldestKey) clientBuckets.delete(oldestKey);
}

/**
 * Per-client warm-instance abuse guard. This intentionally is not the paid-call
 * budget. Paid-provider accounting lives in providerBudget.ts and is durable in
 * Postgres so it remains valid across serverless scale-out.
 */
export function consumeNowClientRateLimit(
  request: Request,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const key = trustedClientKey(request);
  ensureClientSlot(key);

  const current = clientBuckets.get(key) ?? freshBucket(now);
  const client = consume(current, PER_CLIENT_LIMIT, now);
  clientBuckets.set(key, client.bucket);
  return { allowed: client.allowed, retryAfterSeconds: client.retryAfterSeconds };
}

export function resetNowRateLimitsForTests() {
  clientBuckets.clear();
}
