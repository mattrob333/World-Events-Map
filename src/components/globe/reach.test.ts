import { describe, expect, it } from 'vitest';
import type { Beacon } from '@/lib/types';
import { pickReach } from './reach';

const beacon = (eventId: string, city: string, lat: number, lon: number, score: number, extra: Partial<Beacon> = {}): Beacon => ({
  eventId, city, coords: { lat, lon }, score, heat: 'warm', category: 'cultural', label: eventId, relevance: 1, daysUntil: 10, focused: false, peerCount: 0, ...extra,
});

describe('pickReach', () => {
  const atlanta = { lat: 33.75, lon: -84.39 };
  it('puts live events first, then the strongest, one per city, never where they already are', () => {
    const picks = pickReach([
      beacon('local-fest', 'Atlanta', 33.76, -84.4, 99),
      beacon('paris-a', 'Paris', 48.85, 2.35, 90),
      beacon('paris-b', 'Paris', 48.86, 2.34, 80),
      beacon('tokyo', 'Tokyo', 35.68, 139.69, 70),
      beacon('monaco', 'Monte-Carlo', 43.74, 7.42, 40, { live: true }),
    ], atlanta, 3);
    expect(picks.map((b) => b.eventId)).toEqual(['monaco', 'paris-a', 'tokyo']);
  });
});
