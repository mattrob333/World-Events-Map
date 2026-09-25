import { expect, it } from 'vitest';
import { formatMiles, formatNearby } from './units';

it('shows miles and feet', () => {
  expect(formatMiles(7400)).toBe('4,600 mi');
  expect(formatMiles(1030)).toBe('640 mi');
  expect(formatMiles(5)).toBe('3.1 mi');
  expect(formatNearby(120)).toBe('390 ft away');
  expect(formatNearby(1500)).toBe('0.9 mi away');
});
