import { describe, expect, it } from 'vitest';
import type { PulseVenue } from '../pulse';
import { buildTonight, hourLabel, nightClock } from '../tonight';

const venue = (id: string, closesMinutes?: number, extra: Partial<PulseVenue> = {}): PulseVenue => ({ id, name: id, category: 'BAR', lat: 0, lng: 0, busyness: 50, basis: 'forecast', closesMinutes, ...extra });

describe('buildTonight', () => {
  it('runs from this hour to the last close, with hourly ticks', () => {
    // 9:40pm; one bar till 2am, one till 11:30pm.
    const t = buildTonight([venue('late', 1560), venue('early', 1410)], 21 * 60 + 40);
    expect([t.start, t.end]).toEqual([21 * 60, 26 * 60]);
    expect(t.ticks.map((tick) => tick.label)).toEqual(['9pm', '10pm', '11pm', '12am', '1am', '2am']);
    const late = t.rows.find((row) => row.venue.id === 'late')!;
    expect(late.to).toBe(1);
    expect(late.minutesLeft).toBe(1560 - (21 * 60 + 40));
    expect(t.rows.find((row) => row.venue.id === 'early')!.to).toBeCloseTo((1410 - 1260) / 300);
  });

  it('keeps unknown hours (no end) and drops places already closed', () => {
    const t = buildTonight([venue('unknown'), venue('closed', 20 * 60)], 22 * 60);
    expect(t.rows.map((row) => row.venue.id)).toEqual(['unknown']);
    expect(t.rows[0].to).toBeNull();
    expect(t.end - t.start).toBe(180);
  });

  it('after midnight the clock keeps counting from last night, and open-all-night runs to the end', () => {
    expect(nightClock(60)).toBe(1500);
    const t = buildTonight([venue('diner', undefined, { openAllNight: true }), venue('bar', 1560)], 60);
    expect(t.start).toBe(1500);
    expect(t.rows.find((row) => row.venue.id === 'diner')!.to).toBe(1);
    expect(hourLabel(1560)).toBe('2am');
  });
});
