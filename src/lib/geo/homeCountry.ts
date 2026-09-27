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

/** The country a point falls in: the smallest box that holds it (Switzerland before France), or null. */
export function countryAt(point: GeoPoint): CountryView | null {
  const holding = COUNTRY_VIEWS.filter(({ bounds: [w, s, e, n] }) => point.lon >= w && point.lon <= e && point.lat >= s && point.lat <= n);
  return holding.sort((a, b) => area(a) - area(b))[0] ?? null;
}

/** A frame for somewhere outside the listed countries: about 800 km around the point. */
export function regionAround(point: GeoPoint): [number, number, number, number] {
  const dLat = 7;
  const dLon = Math.min(60, 7 / Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)));
  return [point.lon - dLon, Math.max(-85, point.lat - dLat), point.lon + dLon, Math.min(85, point.lat + dLat)];
}
