import type { Beacon, GeoPoint } from '@/lib/types';
import { angularDistanceRad } from '@/lib/geo/projection';

/** Closer than this (about 150 km) is "already there": no arc. */
const MIN_ANGLE = 150 / 6371;

/**
 * Where the reach arcs from the viewer go: what's live now first, then the
 * strongest, most relevant events, one per city, never somewhere they
 * already are.
 */
export function pickReach(beacons: readonly Beacon[], origin: GeoPoint, count = 5): Beacon[] {
  const ranked = beacons
    .filter((beacon) => angularDistanceRad(origin, beacon.coords) >= MIN_ANGLE)
    .map((beacon) => ({ beacon, rank: (beacon.live ? 200 : 0) + beacon.score * (0.4 + 0.6 * Math.max(0, Math.min(1, beacon.relevance))) }))
    .sort((a, b) => b.rank - a.rank || a.beacon.eventId.localeCompare(b.beacon.eventId));
  const cities = new Set<string>();
  const out: Beacon[] = [];
  for (const { beacon } of ranked) {
    const city = beacon.city.toLowerCase();
    if (cities.has(city)) continue;
    cities.add(city);
    out.push(beacon);
    if (out.length === count) break;
  }
  return out;
}
