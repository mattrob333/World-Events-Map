import { describe, expect, it } from 'vitest';
import { fallbackForTimeZone } from '../useViewerLocation';

describe('viewer launch region', () => {
  it.each([
    ['America/New_York', { lat: 40, lon: -75 }],
    ['America/Los_Angeles', { lat: 38, lon: -122 }],
    ['America/Chicago', { lat: 40, lon: -91 }],
    ['Europe/London', { lat: 48, lon: 10 }],
    ['Asia/Tokyo', { lat: 27, lon: 98 }],
    ['Australia/Sydney', { lat: -27, lon: 134 }],
  ])('starts %s in the relevant world region', (timeZone, expected) => {
    expect(fallbackForTimeZone(timeZone)).toEqual(expected);
  });

  it('keeps the unknown fallback over open Atlantic rather than the old Africa default', () => {
    expect(fallbackForTimeZone('UTC')).toEqual({ lat: 20, lon: -30 });
  });
});
