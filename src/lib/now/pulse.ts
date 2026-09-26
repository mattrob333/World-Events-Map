/**
 * Vibe Now: what's busy within five miles of you. Pure helpers shared by the
 * route and the map; the paid lookup lives in pulseService.ts.
 */

export const PULSE_RADIUS_METERS = 8047; // five miles

export type PulseVenue = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  /** 0–100: how busy it is this hour. */
  busyness: number;
  /** 'live' when BestTime measured it now, 'forecast' when it's the usual for this hour. */
  basis: 'live' | 'forecast';
  distanceMeters?: number;
  address?: string;
};

export type PulseResult = {
  venues: PulseVenue[];
  source: 'besttime';
  generatedAt: string;
  /** Where the search was centered: the rounded point we sent, never their exact position. */
  center: { lat: number; lng: number };
};

/**
 * About a kilometer of rounding: enough for a five-mile scan, and their exact
 * position never leaves the phone.
 */
export function roundForSearch(point: { lat: number; lng: number }): { lat: number; lng: number } {
  const round = (value: number) => Math.round(value * 100) / 100;
  return { lat: round(point.lat), lng: round(point.lng) };
}

type VenueLike = {
  id: string;
  name: string;
  category: string;
  location: { lat: number; lng: number };
  openNow?: boolean;
  expectedBusyness?: number;
  liveBusyness?: number;
  distanceMeters?: number;
  address?: string;
};

/** Busiest first; closed places and places without a reading are left off rather than shown as quiet. */
export function toPulseVenues(venues: readonly VenueLike[], limit = 30): PulseVenue[] {
  const out: PulseVenue[] = [];
  for (const venue of venues) {
    if (venue.openNow === false) continue;
    const live = typeof venue.liveBusyness === 'number' && Number.isFinite(venue.liveBusyness);
    const value = live ? venue.liveBusyness! : venue.expectedBusyness;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    out.push({
      id: venue.id,
      name: venue.name.slice(0, 80),
      category: venue.category,
      lat: venue.location.lat,
      lng: venue.location.lng,
      busyness: Math.max(0, Math.min(100, Math.round(value))),
      basis: live ? 'live' : 'forecast',
      distanceMeters: venue.distanceMeters,
      address: venue.address?.slice(0, 140),
    });
  }
  return out.sort((a, b) => b.busyness - a.busyness || (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0)).slice(0, limit);
}

/** How a venue draws on the map: the busiest are clearly the biggest and tallest. */
export function pulseStyle(busyness: number, busiest: number): { radius: number; height: number; rank: number } {
  const share = busiest > 0 ? Math.max(0, Math.min(1, busyness / busiest)) : 0;
  // Squared so the top spots stand well clear of the pack.
  const emphasis = share * share;
  return { radius: Math.round(10 + 34 * emphasis), height: Math.round(40 + 460 * emphasis), rank: share };
}

/** A small circle as a polygon ring, for the 3D column under each pulse. */
export function circleRing(center: { lat: number; lng: number }, meters: number, steps = 20): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)]);
  }
  return ring;
}
