import 'server-only';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { closesTonight, localNow, type HoursPeriod } from './googleHours';
import type { PulseVenue } from './pulse';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = 'places.displayName,places.currentOpeningHours.periods,places.regularOpeningHours.periods,places.utcOffsetMinutes,places.googleMapsUri';
const MAX_LOOKUPS = 10;
const TTL_MS = 12 * 60 * 60 * 1000;

type Found = { periods: HoursPeriod[]; utcOffsetMinutes: number; mapsUrl?: string };
const cache = new Map<string, { found: Found | null; at: number }>();

async function lookup(venue: PulseVenue, key: string): Promise<Found | null> {
  const hit = cache.get(venue.id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.found;
  if (!(await takeShared('places'))) return null;
  let found: Found | null = null;
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({
        textQuery: [venue.name, venue.address].filter(Boolean).join(', ').slice(0, 200),
        maxResultCount: 1,
        locationBias: { circle: { center: { latitude: venue.lat, longitude: venue.lng }, radius: 400 } },
      }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (response.ok) {
      const body = (await response.json()) as { places?: { currentOpeningHours?: { periods?: HoursPeriod[] }; regularOpeningHours?: { periods?: HoursPeriod[] }; utcOffsetMinutes?: number; googleMapsUri?: string }[] };
      const place = body.places?.[0];
      const periods = place?.currentOpeningHours?.periods ?? place?.regularOpeningHours?.periods;
      if (place && Array.isArray(periods) && typeof place.utcOffsetMinutes === 'number') {
        const mapsUrl = typeof place.googleMapsUri === 'string' && /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)\//.test(place.googleMapsUri) ? place.googleMapsUri : undefined;
        found = { periods, utcOffsetMinutes: place.utcOffsetMinutes, ...(mapsUrl ? { mapsUrl } : {}) };
      }
    }
  } catch {
    found = null;
  }
  if (cache.size > 2000) cache.delete(cache.keys().next().value!);
  cache.set(venue.id, { found, at: Date.now() });
  return found;
}

/**
 * Fills tonight's closing time from Google Places for the places BestTime had
 * no hours for (the busiest first, at most ten per search, remembered for 12
 * hours, inside the shared daily `places` budget). A place Google shows as
 * closed right now is dropped: it isn't somewhere to go tonight.
 */
export async function withGoogleHours(venues: PulseVenue[], now = new Date()): Promise<PulseVenue[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const marked = venues.map((venue) => (venue.closesMinutes !== undefined ? { ...venue, hoursFrom: 'besttime' as const } : venue));
  if (!key) return marked;
  const missing = marked.filter((venue) => venue.closesMinutes === undefined).sort((a, b) => b.busyness - a.busyness).slice(0, MAX_LOOKUPS);
  const results = new Map(await Promise.all(missing.map(async (venue) => [venue.id, await lookup(venue, key)] as const)));
  const out: PulseVenue[] = [];
  for (const venue of marked) {
    const found = results.get(venue.id);
    if (!found) {
      out.push(venue);
      continue;
    }
    const closes = closesTonight(found.periods, localNow(now, found.utcOffsetMinutes));
    if (closes === null) continue;
    out.push({
      ...venue,
      hoursFrom: 'google',
      ...(closes === 'open-24h' ? { openAllNight: true } : { closesMinutes: closes }),
      ...(found.mapsUrl ? { mapsUrl: found.mapsUrl } : {}),
    });
  }
  return out;
}
