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

export class NowProviderBudgetExceededError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('NOW paid-provider budget is temporarily exhausted.');
    this.name = 'NowProviderBudgetExceededError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

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
 * Per-client admission guard. Run this before parsing the body so one noisy
 * caller cannot consume unbounded CPU. This is separate from paid-provider
 * accounting because cache hits should not consume the shared provider budget.
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

/**
 * Shared warm-instance cost guard for actual outbound provider calls. Callers
 * must invoke this immediately before an external paid-provider request, not at
 * the HTTP route boundary, so cache-only requests are free from this budget.
 */
export function consumeNowProviderBudget(
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const global = consume(globalBucket, GLOBAL_WARM_INSTANCE_LIMIT, now);
  globalBucket = global.bucket;
  return { allowed: global.allowed, retryAfterSeconds: global.retryAfterSeconds };
}

export function requireNowProviderBudget(now = Date.now()) {
  const result = consumeNowProviderBudget(now);
  if (!result.allowed) {
    throw new NowProviderBudgetExceededError(result.retryAfterSeconds);
  }
}

export function resetNowRateLimitsForTests() {
  clientBuckets.clear();
  globalBucket = { count: 0, resetAt: 0 };
}
