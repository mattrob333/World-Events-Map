import { describe, expect, it } from 'vitest';
import { addDays, calendarDateInTimeZone } from './useTimelineStore';

describe('viewer calendar date', () => {
  it('keeps Atlanta on September 22 after the UTC day rolls over', () => {
    const instant = new Date('2026-09-23T02:30:00Z');
    expect(calendarDateInTimeZone(instant, 'America/New_York')).toBe('2026-09-22');
    expect(calendarDateInTimeZone(instant, 'Europe/Paris')).toBe('2026-09-23');
  });

  it('keeps UTC date arithmetic independent of the viewer time zone', () => {
    expect(addDays('2026-09-22', 1)).toBe('2026-09-23');
  });
});
