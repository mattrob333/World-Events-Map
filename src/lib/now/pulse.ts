/**
 * Vibe Now: what's busy within five miles of you. Pure helpers shared by the
 * route and the map; the paid lookup lives in pulseService.ts.
 */

export const PULSE_RADIUS_METERS = 8047; // five miles
export const PULSE_MAX_RADIUS_METERS = 16093; // ten miles
/** The radius choices on the map: 2, 5 and 10 miles. */
export const PULSE_RADII = [{ miles: 2, meters: 3219 }, { miles: 5, meters: 8047 }, { miles: 10, meters: 16093 }] as const;
export const PULSE_WHATS = ['drinks', 'food', 'music', 'experience', 'surprise'] as const;
export type PulseWhat = (typeof PULSE_WHATS)[number];

/** "open till 2am", "open till 11:30pm"; nothing when unknown. */
export function closesLabel(minutes: number | undefined): string | null {
  if (minutes === undefined || !Number.isFinite(minutes)) return null;
  const within = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(within / 60);
  const m = within % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'am' : 'pm';
  if (within === 0) return 'open till midnight';
  return `open till ${hour12}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`;
}

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
  /** Tonight's closing time, minutes after midnight (2am = 1560). */
  closesMinutes?: number;
  /** Open around the clock tonight. */
  openAllNight?: boolean;
  /** Whose hours these are: BestTime's venue hours, or Google Places. */
  hoursFrom?: 'besttime' | 'google';
  /** The place on Google Maps, when Google Places knew it. */
  mapsUrl?: string;
  /** Signed by the server: lets a member ask for this place's live reading. */
  liveToken?: string;
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
  closesMinutes?: number;
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
      closesMinutes: venue.closesMinutes,
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

export type BeamOnScreen = { id: string; x: number; y: number; /** How far up the screen the beam's top sits above its base, in pixels. */ rise: number; busyness: number };

/** Screen pixels per meter at a latitude and zoom (512-pixel tiles, as MapLibre draws them). */
export function pixelsPerMeter(lat: number, zoom: number): number {
  return (512 * 2 ** zoom) / (40_075_016.686 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
}

/**
 * The beam a thumb meant: the closest one to the tap, measured to the whole
 * beam (base to top) rather than its footprint, within a thumb's reach. Ties
 * go to the busier place.
 */
export function nearestBeam(tap: { x: number; y: number }, beams: readonly BeamOnScreen[], reach = 30): string | null {
  let best: { id: string; distance: number; busyness: number } | null = null;
  for (const beam of beams) {
    const topY = beam.y - Math.max(0, beam.rise);
    // Distance from the tap to the vertical segment between the base and the top.
    const y = Math.max(topY, Math.min(beam.y, tap.y));
    const distance = Math.hypot(tap.x - beam.x, tap.y - y);
    if (distance > reach) continue;
    if (!best || distance < best.distance - 2 || (Math.abs(distance - best.distance) <= 2 && beam.busyness > best.busyness)) best = { id: beam.id, distance, busyness: beam.busyness };
  }
  return best?.id ?? null;
}
