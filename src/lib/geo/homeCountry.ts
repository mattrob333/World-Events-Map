import type { GeoPoint } from '@/lib/types';

/**
 * Home: the country around a traveler, framed to fit one screen. Boxes are
 * [west, south, east, north] around each country's main landmass (the lower
 * 48 for the US), rounded outward. Where someone is comes from their device
 * and never leaves it; this only picks the frame.
 */
export type CountryView = { code: string; name: string; bounds: [number, number, number, number] };

export const COUNTRY_VIEWS: readonly CountryView[] = [
  { code: 'US', name: 'United States', bounds: [-125, 24, -66.5, 49.5] },
  { code: 'CA', name: 'Canada', bounds: [-141, 41.5, -52.5, 70] },
  { code: 'MX', name: 'Mexico', bounds: [-118, 14.5, -86.5, 33] },
  { code: 'GB', name: 'United Kingdom', bounds: [-8.7, 49.8, 2, 59.5] },
  { code: 'IE', name: 'Ireland', bounds: [-10.7, 51.4, -5.9, 55.5] },
  { code: 'FR', name: 'France', bounds: [-5.2, 41.3, 9.7, 51.2] },
  { code: 'ES', name: 'Spain', bounds: [-9.5, 35.9, 3.4, 43.9] },
  { code: 'PT', name: 'Portugal', bounds: [-9.6, 36.9, -6.1, 42.2] },
  { code: 'IT', name: 'Italy', bounds: [6.6, 36.6, 18.6, 47.1] },
  { code: 'DE', name: 'Germany', bounds: [5.8, 47.2, 15.1, 55.1] },
  { code: 'CH', name: 'Switzerland', bounds: [5.9, 45.8, 10.5, 47.9] },
  { code: 'AT', name: 'Austria', bounds: [9.5, 46.3, 17.2, 49.1] },
  { code: 'NL', name: 'Netherlands', bounds: [3.3, 50.7, 7.3, 53.6] },
  { code: 'BE', name: 'Belgium', bounds: [2.5, 49.5, 6.5, 51.6] },
  { code: 'GR', name: 'Greece', bounds: [19.3, 34.8, 28.3, 41.8] },
  { code: 'SE', name: 'Sweden', bounds: [10.9, 55.3, 24.2, 69.1] },
  { code: 'NO', name: 'Norway', bounds: [4.5, 57.9, 31.2, 71.2] },
  { code: 'JP', name: 'Japan', bounds: [128.5, 30.9, 146, 45.6] },
  { code: 'AU', name: 'Australia', bounds: [112.9, -43.7, 153.7, -10.6] },
  { code: 'NZ', name: 'New Zealand', bounds: [166.3, -47.4, 178.6, -34.3] },
  { code: 'BR', name: 'Brazil', bounds: [-74, -33.8, -34.7, 5.3] },
  { code: 'AR', name: 'Argentina', bounds: [-73.6, -55.1, -53.6, -21.7] },
  { code: 'AE', name: 'United Arab Emirates', bounds: [51.5, 22.6, 56.4, 26.1] },
  { code: 'IN', name: 'India', bounds: [68.1, 6.7, 97.4, 35.5] },
  { code: 'TH', name: 'Thailand', bounds: [97.3, 5.6, 105.7, 20.5] },
  { code: 'ZA', name: 'South Africa', bounds: [16.4, -34.9, 32.9, -22.1] },
];

const area = (view: CountryView) => (view.bounds[2] - view.bounds[0]) * (view.bounds[3] - view.bounds[1]);

/**
 * The lower 48, roughly: the US box alone takes in Toronto, Vancouver and
 * Montreal, and Mexico's box takes in Texas. Points are [lon, lat], drawn
 * along the Canadian border (through the Great Lakes) and the Mexican border,
 * out to sea elsewhere. Border towns can still land on the wrong side.
 */
const LOWER_48: readonly [number, number][] = [
  [-125, 49], [-95.2, 49], [-89.6, 48], [-84.8, 46.5], [-82.4, 45.3], [-83, 42], [-79, 43.3], [-76.3, 44.2],
  [-74.7, 45], [-71.5, 45], [-70, 46.7], [-67.8, 47.1], [-67, 45], [-66, 44], [-80, 24], [-97.1, 25.9],
  [-99.5, 27.5], [-101.4, 29.8], [-103, 29], [-106.5, 31.8], [-108.2, 31.3], [-111.1, 31.3], [-114.8, 32.5],
  [-117.1, 32.5], [-118, 32], [-125, 40],
];

function inside(point: GeoPoint, ring: readonly [number, number][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > point.lat) !== (yj > point.lat) && point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The device's time zone, when it names one of the listed countries: settles boxes that overlap (Strasbourg is in Germany's box too). */
const ZONE_COUNTRY: Record<string, string> = {
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Lisbon': 'PT',
  'Europe/Rome': 'IT', 'Europe/Berlin': 'DE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Athens': 'GR', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/Mexico_City': 'MX', 'America/Tijuana': 'MX', 'America/Monterrey': 'MX', 'America/Cancun': 'MX',
};

/**
 * The country a point falls in: the lower 48 by outline, the others by box
 * (the device's time zone first where boxes overlap, then the smallest), or
 * null when it isn't one of the listed countries.
 */
export function countryAt(point: GeoPoint, zone?: string): CountryView | null {
  if (inside(point, LOWER_48)) return COUNTRY_VIEWS.find((view) => view.code === 'US') ?? null;
  const holding = COUNTRY_VIEWS.filter(({ code, bounds: [w, s, e, n] }) => code !== 'US' && point.lon >= w && point.lon <= e && point.lat >= s && point.lat <= n);
  const zoned = zone ? holding.find((view) => view.code === ZONE_COUNTRY[zone]) : undefined;
  return zoned ?? holding.sort((a, b) => area(a) - area(b))[0] ?? null;
}

type Placed = { country: string; countryCode: string; coords: GeoPoint };

/**
 * Somewhere the list doesn't cover (Singapore, Kenya, Alaska): the country of
 * the nearest place on the calendar within about 600 km, framed around its
 * events and the traveler. Null when nothing on the calendar is that close.
 */
export function countryFromCalendar(point: GeoPoint, events: readonly Placed[]): CountryView | null {
  const km = (a: GeoPoint, b: GeoPoint) => {
    const rad = Math.PI / 180;
    const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
    return 12_742 * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  let nearest: { event: Placed; km: number } | null = null;
  for (const event of events) {
    const d = km(point, event.coords);
    if (!nearest || d < nearest.km) nearest = { event, km: d };
  }
  if (!nearest || nearest.km > 600) return null;
  const { countryCode, country } = nearest.event;
  const points = [point, ...events.filter((event) => event.countryCode === countryCode && km(point, event.coords) <= 1500).map((event) => event.coords)];
  let [w, s, e, n] = [Math.min(...points.map((p) => p.lon)), Math.min(...points.map((p) => p.lat)), Math.max(...points.map((p) => p.lon)), Math.max(...points.map((p) => p.lat))];
  // At least a couple of degrees across, so a city-state isn't one blown-up block.
  const padLon = Math.max(1, (2 - (e - w)) / 2);
  const padLat = Math.max(1, (2 - (n - s)) / 2);
  [w, s, e, n] = [w - padLon, s - padLat, e + padLon, n + padLat];
  return { code: countryCode, name: country, bounds: [w, s, e, n] };
}

/** A frame for somewhere outside the listed countries: about 800 km around the point. */
export function regionAround(point: GeoPoint): [number, number, number, number] {
  const dLat = 7;
  const dLon = Math.min(60, 7 / Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)));
  return [point.lon - dLon, Math.max(-85, point.lat - dLat), point.lon + dLon, Math.min(85, point.lat + dLat)];
}
