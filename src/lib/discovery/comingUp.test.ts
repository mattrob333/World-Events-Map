import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import type { WorldEvent } from '@/lib/types';
import { buildLanes, COMING_UP_DAYS } from './comingUp';

const base = EVENTS[0];
const ev = (id: string, start: string, end: string, extra: Partial<WorldEvent> = {}): WorldEvent => ({ ...base, id, start, end, ...extra });
const today = '2026-09-24';

describe('coming-up calendar lanes', () => {
  it('ranks short moments ahead of long seasons', () => {
    const seasons = Array.from({ length: 10 }, (_, i) => ev(`season-${i}`, '2026-07-01', '2026-11-30'));
    const lanes = buildLanes([...seasons, ev('fest', '2026-09-19', '2026-10-04'), ev('cup', '2026-09-25', '2026-09-27')], today);
    const ids = lanes.map((lane) => lane.event.id);
    expect(ids).toContain('fest');
    expect(ids).toContain('cup');
    expect(lanes.length).toBeLessThanOrEqual(8);
  });

  it('clips bars to the window and skips what is over', () => {
    const lanes = buildLanes([ev('over', '2026-09-01', '2026-09-20'), ev('now', '2026-09-20', '2026-09-26')], today);
    expect(lanes.map((lane) => lane.event.id)).toEqual(['now']);
    expect(lanes[0].bar).toEqual({ from: 0, to: 2 });
  });

  it('shows a plan-by marker for a trip beyond the window when its date falls inside it', () => {
    const later = ev('later', '2026-12-10', '2026-12-12', { bookingLeadDays: 60 });
    const [lane] = buildLanes([later], today);
    expect(lane.bar).toBeUndefined();
    expect(lane.planCol).toBe(17); // Oct 11
    expect(lane.planCol!).toBeLessThan(COMING_UP_DAYS);
  });
});

describe('coming-up heads-ups', () => {
  it('keeps room for plan-by markers when the week is busy', () => {
    const busy = Array.from({ length: 12 }, (_, i) => ev(`on-${i}`, '2026-09-23', '2026-09-26'));
    const later = ev('later', '2026-12-10', '2026-12-12', { bookingLeadDays: 60 });
    const ids = buildLanes([...busy, later], today).map((lane) => lane.event.id);
    expect(ids).toContain('later');
    expect(ids.length).toBeLessThanOrEqual(8);
  });
});

describe('coming-up mix', () => {
  it('leaves room for what starts soon on a busy day', () => {
    const busy = Array.from({ length: 10 }, (_, i) => ev(`on-${i}`, '2026-09-23', '2026-09-26'));
    const ids = buildLanes([...busy, ev('tomorrow', '2026-09-25', '2026-09-27')], today).map((lane) => lane.event.id);
    expect(ids).toContain('tomorrow');
  });
});
