/**
 * Abuse limits for /api/activity-conditions. Only edge-cache misses reach the
 * route, and those are the requests that cost upstream calls.
 */

/** Upstream-bound requests per client per 10 minutes: far past anyone browsing spots. */
export const PER_CLIENT_MISSES = 60;
/** Upstream-bound requests per warm instance per minute, whoever sends them. */
export const INSTANCE_MISSES_PER_MINUTE = 240;
let instanceWindow = { start: 0, count: 0 };

export function instanceAllows(now: number): boolean {
  if (now - instanceWindow.start >= 60_000) instanceWindow = { start: now, count: 0 };
  instanceWindow.count += 1;
  return instanceWindow.count <= INSTANCE_MISSES_PER_MINUTE;
}

export function resetActivityConditionsLimitsForTests() {
  instanceWindow = { start: 0, count: 0 };
}
