import 'server-only';
import { takeShared } from '@/lib/designer/server/sharedBudget';
import { dailyCalls, memberCharge, type MemberCharge } from './liveBusyness';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
// Name, address, point and the local clock: enough to plan a night from a hotel, nothing more.
const FIELDS = 'places.displayName,places.formattedAddress,places.location,places.utcOffsetMinutes';
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5;
const MAX_QUERY = 120;

/** A place they'll be staying or starting from: a hotel, an Airbnb's street, any address. */
export type WherePlace = { name: string; address: string; lat: number; lng: number; utcOffsetMinutes?: number };
export type WhereResult = { places: WherePlace[]; reason?: 'budget' | 'unavailable' };

/** One member's daily share of address lookups, separate from the venue lookups on the map. */
export function whereMemberCharge(memberId: string): MemberCharge {
  return memberCharge(memberId, 'whrM', dailyCalls('GOOGLE_WHERE_MEMBER_DAILY_CALLS', 20));
}

/** "  The  Ritz  , Tulum " → "the ritz, tulum": the cache key, so the same search costs once a day. */
export function normalQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim().toLowerCase().slice(0, MAX_QUERY);
}

/** Reads Google's answer: only places with a real point, a name and an address. Exported for tests. */
export function parseWhere(body: unknown): WherePlace[] {
  const places = body && typeof body === 'object' && Array.isArray((body as { places?: unknown }).places) ? (body as { places: unknown[] }).places : [];
  const out: WherePlace[] = [];
  for (const raw of places) {
    if (!raw || typeof raw !== 'object') continue;
    const place = raw as { displayName?: { text?: unknown }; formattedAddress?: unknown; location?: { latitude?: unknown; longitude?: unknown }; utcOffsetMinutes?: unknown };
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    const name = typeof place.displayName?.text === 'string' ? place.displayName.text.slice(0, 80) : '';
    const address = typeof place.formattedAddress === 'string' ? place.formattedAddress.slice(0, 160) : '';
    if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !name) continue;
    const offset = place.utcOffsetMinutes;
    out.push({ name, address, lat, lng, ...(typeof offset === 'number' && Number.isInteger(offset) && Math.abs(offset) <= 14 * 60 ? { utcOffsetMinutes: offset } : {}) });
    if (out.length === MAX_RESULTS) break;
  }
  return out;
}

const cache = new Map<string, { at: number; places: WherePlace[] }>();

/**
 * Finds a hotel or address with Google Places text search. Remembered for a
 * day per query (shared by everyone), then one call inside the member's own
 * daily share and the site's daily Places budget. The query isn't logged or
 * stored beyond that in-memory cache.
 */
export async function findWhere(query: string, key: string, charge: MemberCharge, now = Date.now()): Promise<WhereResult> {
  const hit = cache.get(query);
  if (hit && now - hit.at < TTL_MS) return { places: hit.places };
  if (!(await charge.take())) return { places: [], reason: 'budget' };
  if (!(await takeShared('places'))) {
    await charge.refund();
    return { places: [], reason: 'budget' };
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({ textQuery: query, maxResultCount: MAX_RESULTS }),
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (!response.ok) return { places: [], reason: 'unavailable' };
    const places = parseWhere(await response.json());
    cache.set(query, { at: now, places });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return { places };
  } catch {
    return { places: [], reason: 'unavailable' };
  }
}

export function resetWhereCacheForTests() {
  cache.clear();
}
