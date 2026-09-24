import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { recommendDestinations } from './recommend';

describe('destination recommendations', () => {
  it('answers "best ski right now" with ski events in the window, one per city', () => {
    const recs = recommendDestinations(EVENTS, '2026-12-01', 'ski');
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((rec) => rec.event.category === 'ski')).toBe(true);
    expect(new Set(recs.map((rec) => rec.event.city)).size).toBe(recs.length);
    expect(recs.every((rec) => rec.event.end >= '2026-12-01')).toBe(true);
  });

  it('is deterministic and ranked by buzz', () => {
    const a = recommendDestinations(EVENTS, '2026-09-24', 'food');
    expect(recommendDestinations(EVENTS, '2026-09-24', 'food')).toEqual(a);
    for (let i = 1; i < a.length; i++) expect(a[i - 1]!.buzz).toBeGreaterThanOrEqual(a[i]!.buzz);
  });

  it('returns nothing rather than inventing for kinds the calendar does not cover', () => {
    expect(recommendDestinations(EVENTS, '2026-09-24', 'points')).toEqual([]);
  });
});
