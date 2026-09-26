import { describe, expect, it } from 'vitest';
import { circleRing, pulseStyle, roundForSearch, toPulseVenues } from '../pulse';

const venue = (id: string, extra: Record<string, unknown>) => ({ id, name: id, category: 'BAR', location: { lat: 33.75, lng: -84.39 }, ...extra });

describe('Vibe Now pulse', () => {
  it('rounds their position to about a kilometer before it leaves the phone', () => {
    expect(roundForSearch({ lat: 33.748123, lng: -84.387654 })).toEqual({ lat: 33.75, lng: -84.39 });
  });

  it('ranks busiest first and leaves off closed places and places without a reading', () => {
    const out = toPulseVenues([
      venue('quiet', { expectedBusyness: 20 }),
      venue('closed', { expectedBusyness: 90, openNow: false }),
      venue('unknown', {}),
      venue('packed', { expectedBusyness: 85 }),
      venue('live', { expectedBusyness: 10, liveBusyness: 70 }),
    ]);
    expect(out.map((v) => v.id)).toEqual(['packed', 'live', 'quiet']);
    expect(out[1]).toMatchObject({ busyness: 70, basis: 'live' });
    expect(out[0]).toMatchObject({ basis: 'forecast' });
  });

  it('makes the busiest place clearly the biggest and tallest', () => {
    const top = pulseStyle(90, 90);
    const half = pulseStyle(45, 90);
    expect(top.radius).toBeGreaterThan(half.radius * 1.8);
    expect(top.height).toBeGreaterThan(half.height * 3);
  });

  it('draws a closed ring around the point', () => {
    const ring = circleRing({ lat: 33.75, lng: -84.39 }, 50);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(Math.abs(ring[0]![0] - -84.39)).toBeGreaterThan(0);
  });
});
