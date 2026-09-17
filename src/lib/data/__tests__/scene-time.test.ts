import { expect, it } from 'vitest';
import { isHappeningToday } from '../scene-time';
it('evaluates today in the destination timezone across midnight', () => {
  const now = new Date('2026-09-17T01:00:00Z');
  expect(isHappeningToday({ start: '2026-09-16', end: '2026-09-16', timezone: 'America/New_York' }, now)).toBe(true);
  expect(isHappeningToday({ start: '2026-09-16', end: '2026-09-16', timezone: 'Asia/Tokyo' }, now)).toBe(false);
  expect(isHappeningToday({ start: '2026-09-17', end: '2026-09-17', timezone: 'Asia/Tokyo' }, now)).toBe(true);
});
