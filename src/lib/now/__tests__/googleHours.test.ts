import { describe, expect, it } from 'vitest';
import { closesTonight, localNow, type HoursPeriod } from '../googleHours';

const p = (openDay: number, openH: number, closeDay: number, closeH: number, closeM = 0): HoursPeriod => ({ open: { day: openDay, hour: openH, minute: 0 }, close: { day: closeDay, hour: closeH, minute: closeM } });

describe('closesTonight', () => {
  // Friday 22:00 in Omaha.
  const fri10pm = { day: 5, minutes: 22 * 60 };

  it('a bar open Friday 4pm till 2am Saturday closes at 1560 (2am tomorrow)', () => {
    expect(closesTonight([p(5, 16, 6, 2)], fri10pm)).toBe(1560);
  });
  it('a restaurant open till 11:30pm closes at 1410', () => {
    expect(closesTonight([p(5, 11, 5, 23, 30)], fri10pm)).toBe(1410);
  });
  it('closed now is null', () => {
    expect(closesTonight([p(5, 11, 5, 21)], fri10pm)).toBeNull();
  });
  it('still open at 1am Saturday from Friday night: closes at 120 (2am today)', () => {
    expect(closesTonight([p(5, 16, 6, 2)], { day: 6, minutes: 60 })).toBe(120);
  });
  it('Saturday night into Sunday wraps the week', () => {
    expect(closesTonight([p(6, 18, 0, 3)], { day: 6, minutes: 23 * 60 })).toBe(1620);
    expect(closesTonight([p(6, 18, 0, 3)], { day: 0, minutes: 90 })).toBe(180);
  });
  it('a period with no close means open around the clock', () => {
    expect(closesTonight([{ open: { day: 0, hour: 0, minute: 0 } }], fri10pm)).toBe('open-24h');
  });
});

describe('localNow', () => {
  it('uses the place’s offset, not the server’s clock', () => {
    // 2026-09-26 03:30 UTC is Friday 22:30 in Omaha (UTC-5 in September).
    expect(localNow(new Date('2026-09-26T03:30:00Z'), -300)).toEqual({ day: 5, minutes: 22 * 60 + 30 });
  });
});
