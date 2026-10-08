import { expect, it } from 'vitest';
import { clockAt, offsetAt } from '../planFrom';

it('reads the place’s offset from its zone, so a saved hotel survives a clock change', () => {
  // Saved in New York summer (UTC-4); planning in winter must read UTC-5.
  const saved = { utcOffsetMinutes: -240, timeZone: 'America/New_York' };
  expect(offsetAt(saved, new Date('2026-07-10T12:00:00Z'))).toBe(-240);
  expect(offsetAt(saved, new Date('2026-12-10T12:00:00Z'))).toBe(-300);
  // Half-hour zones come through whole.
  expect(offsetAt({ timeZone: 'Asia/Kolkata' }, new Date('2026-12-10T12:00:00Z'))).toBe(330);
});

it('falls back to the saved offset for older picks and unknown zones', () => {
  const now = new Date('2026-12-10T12:00:00Z');
  expect(offsetAt({ utcOffsetMinutes: -300 }, now)).toBe(-300);
  expect(offsetAt({ utcOffsetMinutes: -300, timeZone: 'Nowhere/Real' }, now)).toBe(-300);
  expect(offsetAt(null, now)).toBeUndefined();
});

it('gives the wall clock there', () => {
  const now = new Date('2026-12-10T23:30:00Z');
  const there = clockAt(now, offsetAt({ timeZone: 'America/Cancun' }, now));
  expect([there.getHours(), there.getMinutes(), there.getDay()]).toEqual([18, 30, 4]);
});
