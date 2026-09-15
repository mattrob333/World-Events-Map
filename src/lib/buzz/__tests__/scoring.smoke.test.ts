import { describe, expect, it } from 'vitest';

import { EVENTS } from '@/lib/data/events';
import { SIGNAL_KEYS, assertComponentsSum, scoreEvent } from '@/lib/buzz/scoring';

/**
 * Smoke test for the buzz scorer against the real curated calendar.
 *
 * The invariant under test is the one documented in `src/lib/types.ts` and at
 * the top of `scoring.ts`: the six weighted `components` sum to `score`
 * exactly at display precision. The reference date is pinned so the result is
 * reproducible and does not depend on the wall clock.
 */
describe('buzz scoring — components sum invariant', () => {
  // Inside the calendar's horizon (2026-07-26 → 2027-09-30), so a real event
  // is live and scores above zero rather than exercising the trivial past-event
  // branch.
  const NOW = '2026-09-01';

  it('scores a real event whose components sum to its score', () => {
    const event = EVENTS.find((e) => e.start > NOW);
    expect(event).toBeDefined();

    const result = scoreEvent(event!, { now: NOW });

    expect(result.eventId).toBe(event!.id);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThanOrEqual(100);

    const sum = SIGNAL_KEYS.reduce((acc, key) => acc + result.components[key], 0);
    expect(sum).toBeCloseTo(result.score, 6);
    expect(assertComponentsSum(result)).toBe(true);
  });
});
