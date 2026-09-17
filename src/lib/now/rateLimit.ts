const WINDOW_MS = 10 * 60 * 1000;
const PER_CLIENT_LIMIT = 12;
const GLOBAL_WARM_INSTANCE_LIMIT = 120;
const MAX_TRACKED_CLIENTS = 5000;

type Bucket = {
  count: number;
  resetAt: number;
};

const clientBuckets = new Map<string, Bucket>();
let globalBucket: Bucket = { count: 0, resetAt: 0 };

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

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const firstForwarded = forwarded?.split(',')[0]?.trim();
  return firstForwarded || request.headers.get('x-real-ip') || 'unknown';
}

function prune(now: number) {
  if (clientBuckets.size < MAX_TRACKED_CLIENTS) return;
  for (const [key, bucket] of clientBuckets) {
    if (bucket.resetAt <= now) clientBuckets.delete(key);
    if (clientBuckets.size < MAX_TRACKED_CLIENTS) break;
  }
}

/**
 * Warm-instance cost guard for paid NOW providers.
 *
 * This is intentionally a second line of defense, not a claim of globally
 * durable rate limiting. A distributed limiter belongs in front of the route
 * before broad production traffic. The global bucket still limits damage when
 * a client IP cannot be trusted or identified on one server instance.
 */
export function consumeNowRateLimit(
  request: Request,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  prune(now);

  const global = consume(globalBucket, GLOBAL_WARM_INSTANCE_LIMIT, now);
  globalBucket = global.bucket;
  if (!global.allowed) {
    return { allowed: false, retryAfterSeconds: global.retryAfterSeconds };
  }

  const key = clientKey(request);
  const current = clientBuckets.get(key) ?? freshBucket(now);
  const client = consume(current, PER_CLIENT_LIMIT, now);
  clientBuckets.set(key, client.bucket);
  return { allowed: client.allowed, retryAfterSeconds: client.retryAfterSeconds };
}

export function resetNowRateLimitsForTests() {
  clientBuckets.clear();
  globalBucket = { count: 0, resetAt: 0 };
}
