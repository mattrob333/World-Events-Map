import { describe, expect, it } from 'vitest';
import { validateNowRequest } from '../validation';

describe('validateNowRequest', () => {
  it('normalizes a valid mobile request', () => {
    const result = validateNowRequest({
      location: { lat: 40.758, lng: -73.9855 },
      intent: 'drinks',
      vibe: 'social',
      radiusMeters: 3000.4,
      availableMinutes: 180,
      partySize: 2,
      interests: [' food ', 'food', 'music'],
      travelModeName: 'Solo Weekend',
    });

    expect(result.radiusMeters).toBe(3000);
    expect(result.interests).toEqual(['food', 'music']);
    expect(result.travelModeName).toBe('Solo Weekend');
  });

  it('rejects invalid coordinates and oversized radii', () => {
    expect(() => validateNowRequest({
      location: { lat: 100, lng: 0 },
      intent: 'food',
      vibe: 'chill',
      radiusMeters: 1000,
    })).toThrow(/Latitude/);

    expect(() => validateNowRequest({
      location: { lat: 40, lng: -73 },
      intent: 'food',
      vibe: 'chill',
      radiusMeters: 50_000,
    })).toThrow(/Search radius/);
  });

  it('rejects arbitrary intent and overly long interests', () => {
    expect(() => validateNowRequest({
      location: { lat: 40, lng: -73 },
      intent: 'anything',
      vibe: 'social',
      radiusMeters: 3000,
    })).toThrow(/valid NOW intent/);

    expect(() => validateNowRequest({
      location: { lat: 40, lng: -73 },
      intent: 'food',
      vibe: 'social',
      radiusMeters: 3000,
      interests: ['x'.repeat(81)],
    })).toThrow(/80 characters/);
  });
});
