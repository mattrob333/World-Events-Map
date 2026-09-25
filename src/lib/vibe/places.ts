import { RESORTS, type Resort } from '@/lib/geo/resorts';
import type { WorldEvent } from '@/lib/types';

export type Place = {
  /** "city:france:paris" or "resort:switzerland:zermatt". */
  key: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  kind: 'city' | 'resort';
  /** Names a story might use for exactly this place. */
  names: string[];
};

/**
 * Aliases that name a whole ski area or range, not one resort ("3 Vallées" is
 * Courchevel, Méribel and Val Thorens). They're kept for reading requests but
 * never credit a story's mention to a single resort.
 */
const AREA_ALIASES = new Set(['4 vallees', 'four valleys', 'engadin', 'engadine', 'mont blanc', '3 vallees', 'three valleys', 'jungfrau', 'jungfrau region', 'titlis', 'portes du soleil', 'paradiski', 'dolomiti superski', 'via lattea', 'milky way', 'zillertal', 'otztal', 'arlberg', 'zugspitze', 'gastein', 'niseko united', 'happo', 'gala yuzawa', 'kaprun', 'flims', 'lenzerheide']);

export const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (value: string) => fold(value).replace(/\s+/g, '-');

function resortPlace(resort: Resort): Place {
  const names = [resort.name, ...resort.aliases].filter((name) => !AREA_ALIASES.has(fold(name)));
  return { key: `resort:${slug(resort.country)}:${slug(resort.name)}`, name: resort.name, country: resort.country, lat: resort.lat, lon: resort.lon, kind: 'resort', names };
}

/**
 * Every place the engine can rank: resorts, plus each city on the event
 * calendar. A calendar city that is a resort ("St. Moritz", "Courchevel")
 * becomes that resort, so its events and its mentions land in one place.
 */
export function placeIndex(events: readonly WorldEvent[], resorts: readonly Resort[] = RESORTS): Place[] {
  const places = resorts.map(resortPlace);
  const byName = new Map<string, Place>();
  for (const place of places) for (const name of place.names) byName.set(`${fold(name)}|${fold(place.country)}`, place);
  const seen = new Set<string>();
  for (const event of events) {
    const id = `${fold(event.city)}|${fold(event.country)}`;
    if (byName.has(id) || seen.has(id)) continue;
    seen.add(id);
    const place: Place = { key: `city:${slug(event.country)}:${slug(event.city)}`, name: event.city, country: event.country, lat: event.coords.lat, lon: event.coords.lon, kind: 'city', names: [event.city] };
    places.push(place);
    byName.set(id, place);
  }
  return places;
}

/** The place an event happens in, by name, else the nearest place within 25 km. */
export function placeForEvent(event: WorldEvent, places: readonly Place[]): Place | null {
  const city = fold(event.city);
  const country = fold(event.country);
  const named = places.find((place) => fold(place.country) === country && place.names.some((name) => fold(name) === city));
  if (named) return named;
  let best: { place: Place; km: number } | null = null;
  for (const place of places) {
    const d = kmBetween(event.coords, place);
    if (d <= 25 && (!best || d < best.km)) best = { place, km: d };
  }
  return best?.place ?? null;
}

export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
