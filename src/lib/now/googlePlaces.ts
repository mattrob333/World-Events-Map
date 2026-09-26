import 'server-only';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { closesTonight, localNow, type HoursPeriod } from './googleHours';
import type { PulseVenue } from './pulse';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
// All within the Text Search Enterprise tier the opening hours already need: the extra
// fields (type, rating, price, website, phone) don't raise the price of a lookup.
const FIELDS = [
  'places.displayName', 'places.currentOpeningHours.periods', 'places.regularOpeningHours.periods', 'places.utcOffsetMinutes', 'places.googleMapsUri',
  'places.primaryTypeDisplayName', 'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.websiteUri', 'places.nationalPhoneNumber',
].join(',');
const MAX_LOOKUPS = 10;
const TTL_MS = 12 * 60 * 60 * 1000;

/** What Google says about a place, for the card: only what it returned, never filled in. */
export type PlaceDetails = {
  type?: string;
  rating?: number;
  ratingCount?: number;
  price?: string;
  website?: string;
  phone?: string;
  mapsUrl?: string;
  closesMinutes?: number;
  openAllNight?: boolean;
  closedNow?: boolean;
};

type Found = { periods?: HoursPeriod[]; utcOffsetMinutes?: number; mapsUrl?: string; details: PlaceDetails };

const PRICE: Record<string, string> = { PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: '$', PRICE_LEVEL_MODERATE: '$$', PRICE_LEVEL_EXPENSIVE: '$$$', PRICE_LEVEL_VERY_EXPENSIVE: '$$$$' };
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : undefined) || undefined;
const httpsUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 300) return undefined;
  try {
    return new URL(value).protocol === 'https:' ? value : undefined;
  } catch {
    return undefined;
  }
};
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
      type Place = {
        currentOpeningHours?: { periods?: HoursPeriod[] }; regularOpeningHours?: { periods?: HoursPeriod[] }; utcOffsetMinutes?: number; googleMapsUri?: string;
        primaryTypeDisplayName?: { text?: string }; rating?: number; userRatingCount?: number; priceLevel?: string; websiteUri?: string; nationalPhoneNumber?: string;
      };
      const body = (await response.json()) as { places?: Place[] };
      const place = body.places?.[0];
      if (place) {
        const periods = place.currentOpeningHours?.periods ?? place.regularOpeningHours?.periods;
        const mapsUrl = typeof place.googleMapsUri === 'string' && /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)\//.test(place.googleMapsUri) ? place.googleMapsUri : undefined;
        const rating = typeof place.rating === 'number' && place.rating > 0 && place.rating <= 5 ? Math.round(place.rating * 10) / 10 : undefined;
        const ratingCount = typeof place.userRatingCount === 'number' && place.userRatingCount > 0 ? Math.round(place.userRatingCount) : undefined;
        const details: PlaceDetails = {
          type: clean(place.primaryTypeDisplayName?.text, 40),
          ...(rating ? { rating } : {}),
          ...(rating && ratingCount ? { ratingCount } : {}),
          price: place.priceLevel ? PRICE[place.priceLevel] : undefined,
          website: httpsUrl(place.websiteUri),
          phone: clean(place.nationalPhoneNumber, 30)?.replace(/[^0-9+()\- .]/g, '').trim() || undefined,
          mapsUrl,
        };
        found = {
          ...(Array.isArray(periods) && typeof place.utcOffsetMinutes === 'number' ? { periods, utcOffsetMinutes: place.utcOffsetMinutes } : {}),
          ...(mapsUrl ? { mapsUrl } : {}),
          details: Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)) as PlaceDetails,
        };
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
    if (!found?.periods || found.utcOffsetMinutes === undefined) {
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

/**
 * Google's facts about one place a member tapped: its type, rating, price,
 * website, phone and tonight's hours. The same lookup (and 12-hour memory, and
 * daily `places` budget) as the hours above, so a place already looked up
 * costs nothing more.
 */
export async function placeDetails(venue: Pick<PulseVenue, 'id' | 'name' | 'address' | 'lat' | 'lng'>, now = new Date()): Promise<PlaceDetails | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const found = await lookup({ ...venue, category: '', busyness: 0, basis: 'forecast' }, key);
  if (!found) return null;
  const details = { ...found.details };
  if (found.periods && found.utcOffsetMinutes !== undefined) {
    const closes = closesTonight(found.periods, localNow(now, found.utcOffsetMinutes));
    if (closes === null) details.closedNow = true;
    else if (closes === 'open-24h') details.openAllNight = true;
    else details.closesMinutes = closes;
  }
  return details;
}
