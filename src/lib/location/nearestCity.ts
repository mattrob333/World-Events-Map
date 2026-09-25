import type { GeoPoint } from '@/lib/types';

export type City = { name: string; region: string; lat: number; lon: number; popK: number };
export type NamedPlace = { name: string; region: string; km: number; label: string };

/** "Atlanta|Georgia|33.75|-84.39|511" lines (public/geo/cities.txt, from GeoNames, CC BY 4.0). */
export function parseCities(text: string): City[] {
  const cities: City[] = [];
  for (const line of text.split('\n')) {
    const [name, region, lat, lon, popK] = line.split('|');
    if (!name || lat === undefined || lon === undefined) continue;
    const city = { name, region: region ?? '', lat: Number(lat), lon: Number(lon), popK: Number(popK) || 0 };
    if (Number.isFinite(city.lat) && Number.isFinite(city.lon)) cities.push(city);
  }
  return cities;
}

function km(a: GeoPoint, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The city a traveler would say they're in: the biggest city within 10 km (the
 * middle of Paris is Paris, not a suburb whose center happens to be closer);
 * failing that the biggest within 40 km (a suburb of Atlanta says Atlanta);
 * else the nearest, prefixed "Near" when it's more than 25 km off.
 * Nothing leaves the device: the list is a static file and this runs locally.
 */
export function nearestCity(point: GeoPoint, cities: readonly City[]): NamedPlace | null {
  let nearest: { city: City; km: number } | null = null;
  const around: { city: City; km: number }[] = [];
  for (const city of cities) {
    const d = km(point, city);
    if (!nearest || d < nearest.km) nearest = { city, km: d };
    if (d <= 40) around.push({ city, km: d });
  }
  if (!nearest || nearest.km > 300) return null;
  const biggest = (list: { city: City; km: number }[]) => [...list].sort((a, b) => b.city.popK - a.city.popK)[0];
  const pick = biggest(around.filter((entry) => entry.km <= 10)) ?? biggest(around) ?? nearest;
  const name = pick.city.name;
  return { name, region: pick.city.region, km: Math.round(pick.km), label: pick.km > 25 ? `Near ${name}` : name };
}

let loading: Promise<City[]> | null = null;

/** Fetched once, only after the traveler shares their location. */
export function loadCities(): Promise<City[]> {
  loading ??= fetch('/geo/cities.txt', { cache: 'force-cache' })
    .then((response) => (response.ok ? response.text() : ''))
    .then(parseCities)
    .catch(() => {
      loading = null;
      return [];
    });
  return loading;
}
