import 'server-only';

import { tregCall, type TregCallReceipt } from './tregClient';
import {
  fold,
  hiddenGems,
  parseFlights,
  parseGoogleEvents,
  parseGoogleMaps,
  parseInstagram,
  parseTikTok,
  parseTripadvisor,
  parseYelp,
  tiktokThumbnail,
  type DestinationResearch,
  type FlightSection,
  type ResearchPost,
  type ResearchSection,
  type ResearchSourceName,
  type ResearchSpot,
} from './destinationSources';

/**
 * Live research for any place, through Treg. One run makes at most eleven
 * paid calls, each with its own ceiling, and stops starting new calls once
 * the run's reserve would pass CAP_MICRO. Results are cached per place (and
 * flights per route and dates) so reopening a trip does not bill again.
 */

export const CAP_MICRO = 100_000; // $0.10 per research run
const PLACE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED = 200;
/** Per-instance daily ceiling across all runs; a durable budget is needed before opening to others. */
const DAILY_CAP_MICRO = 2_000_000;

type Endpoint = { id: string; method: 'GET' | 'POST'; ceilingUsd: number };
const EP = {
  maps: { id: 'anyapi.google.serp.maps', method: 'POST', ceilingUsd: 0.005 },
  tripadvisor: { id: 'serpapi.x.tripadvisor-search', method: 'GET', ceilingUsd: 0.02 },
  yelp: { id: 'serpapi.x.yelp-search', method: 'GET', ceilingUsd: 0.02 },
  instagram: { id: 'anyapi.instagram.hashtag_recent_posts', method: 'POST', ceilingUsd: 0.005 },
  tiktok: { id: 'anyapi.tiktok.search.videos', method: 'POST', ceilingUsd: 0.005 },
  events: { id: 'dataforseo.x.serp-google-events-live-advanced', method: 'POST', ceilingUsd: 0.005 },
  flights: { id: 'serpapi.x.google-flights', method: 'GET', ceilingUsd: 0.02 },
} satisfies Record<string, Endpoint>;

export type ResearchRequest = {
  name: string;
  region?: string;
  /** Favorite food, to steer the food search. */
  food?: string;
  /** A music scene label ("rock cover bands"), to steer the nightlife search. */
  scene?: string;
  flight?: { from: string; to: string; depart: string; return: string };
};

export type ResearchDeps = {
  token?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (receipt: TregCallReceipt) => void;
};

class Budget {
  spent = 0;
  reserved = 0;
  constructor(readonly cap: number) {}
  /** Reserve the call's ceiling; refuse when it would pass the cap. */
  take(ceilingUsd: number): boolean {
    const micro = Math.round(ceilingUsd * 1_000_000);
    if (this.spent + this.reserved + micro > this.cap) return false;
    this.reserved += micro;
    return true;
  }
  settle(ceilingUsd: number, costMicro: number | null) {
    this.reserved -= Math.round(ceilingUsd * 1_000_000);
    // Unknown charge: count the ceiling so the cap stays conservative.
    this.spent += costMicro ?? Math.round(ceilingUsd * 1_000_000);
  }
}

let day = { key: '', spent: 0 };
function dailyRemaining(now: number): number {
  const key = new Date(now).toISOString().slice(0, 10);
  if (day.key !== key) day = { key, spent: 0 };
  return Math.max(0, DAILY_CAP_MICRO - day.spent);
}

const placeCache = new Map<string, { expires: number; value: Promise<PlaceParts> }>();
const flightCache = new Map<string, { expires: number; value: Promise<FlightSection> }>();

function remember<T>(cache: Map<string, { expires: number; value: Promise<T> }>, key: string, now: number, make: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;
  if (!hit && cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  const value = make();
  cache.set(key, { expires: now + PLACE_TTL_MS, value });
  value.then(
    (result) => { if (!ok(result)) cache.set(key, { expires: now + FAILED_TTL_MS, value }); },
    () => cache.delete(key),
  );
  return value;
}

export function resetResearchCacheForTests() {
  placeCache.clear();
  flightCache.clear();
  day = { key: '', spent: 0 };
}

const section = <T,>(source: ResearchSourceName, status: ResearchSection<T>['status'], note?: string, items: T[] = [], fetchedAt: string | null = null): ResearchSection<T> =>
  ({ status, source, fetchedAt, note, items });

type Caller = <T>(endpoint: Endpoint, request: { query?: Record<string, string>; body?: unknown; maxAge: number }, parse: (json: unknown, fetchedAt: string) => T) =>
  Promise<{ ok: true; value: T; fetchedAt: string } | { ok: false; reason: 'budget' | 'error' }>;

function makeCaller(token: string, budget: Budget, deps: ResearchDeps): Caller {
  return async (endpoint, request, parse) => {
    if (!budget.take(endpoint.ceilingUsd)) return { ok: false, reason: 'budget' };
    let cost: number | null = null;
    try {
      const call = await tregCall({
        endpoint: endpoint.id, method: endpoint.method, query: request.query, body: request.body,
        maxCostUsd: endpoint.ceilingUsd, maxAgeSeconds: request.maxAge, token, fetchImpl: deps.fetchImpl,
        timeoutMs: 20_000, maxBytes: 2_000_000,
        onReceipt: (receipt) => { cost = receipt.costMicro; deps.log?.(receipt); },
      });
      if (!call.ok) return { ok: false, reason: 'error' };
      return { ok: true, value: parse(call.json, call.fetchedAt), fetchedAt: call.fetchedAt };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      budget.settle(endpoint.ceilingUsd, cost);
      day.spent += cost ?? 0;
    }
  };
}

const UNAVAILABLE = 'Couldn’t reach this source just now. Try again in a bit.';
const OVER_BUDGET = 'Skipped to stay under this trip’s research budget.';
const why = (reason: 'budget' | 'error') => (reason === 'budget' ? OVER_BUDGET : UNAVAILABLE);

type PlaceParts = Omit<DestinationResearch, 'flights' | 'generatedAt' | 'configured' | 'spentUsd' | 'capUsd' | 'place'> & { spentMicro: number };

async function spots(call: Caller, source: 'Google Maps' | 'Tripadvisor' | 'Yelp', endpoint: Endpoint, request: Parameters<Caller>[1], parse: (json: unknown) => ResearchSpot[], empty: string) {
  const result = await call(endpoint, request, (json) => parse(json));
  if (!result.ok) return section<ResearchSpot>(source, result.reason === 'budget' ? 'skipped' : 'unavailable', why(result.reason));
  return result.value.length ? section(source, 'ok', undefined, result.value, result.fetchedAt) : section<ResearchSpot>(source, 'empty', empty, [], result.fetchedAt);
}

async function withTikTokCovers(posts: ResearchPost[], fetchImpl: typeof fetch): Promise<ResearchPost[]> {
  return Promise.all(posts.map(async (post) => {
    try {
      const response = await fetchImpl(`https://www.tiktok.com/oembed?url=${encodeURIComponent(post.url)}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (!response.ok) return post;
      const text = await response.text();
      const url = text.length < 200_000 ? tiktokThumbnail(JSON.parse(text)) : undefined;
      return url ? { ...post, image: { url, alt: `TikTok video cover by @${post.author}` } } : post;
    } catch {
      return post;
    }
  }));
}

async function researchPlace(req: ResearchRequest, token: string, deps: ResearchDeps): Promise<PlaceParts> {
  const now = deps.now?.() ?? Date.now();
  const budget = new Budget(Math.min(CAP_MICRO, dailyRemaining(now)));
  const call = makeCaller(token, budget, deps);
  const where = req.region ? `${req.name}, ${req.region}` : req.name;
  const names = [req.name];
  const maps = (query: string) => ({ body: { query, location: where, limit: 12, language: 'en' }, maxAge: 86_400 });

  const [topSpots, food, nightlife, tripadvisor, yelp] = await Promise.all([
    spots(call, 'Google Maps', EP.maps, maps('top attractions'), parseGoogleMaps, 'Google Maps returned no sights for this place.'),
    spots(call, 'Google Maps', EP.maps, maps(req.food ? `best ${req.food}` : 'best local restaurants'), parseGoogleMaps, 'No restaurants came back for this place.'),
    spots(call, 'Google Maps', EP.maps, maps(req.scene ? `${req.scene} bar` : 'live music bar'), parseGoogleMaps, 'No bars or venues came back for this place.'),
    spots(call, 'Tripadvisor', EP.tripadvisor, { query: { engine: 'tripadvisor', q: where, ssrc: 'A' }, maxAge: 86_400 }, parseTripadvisor, 'Tripadvisor had no things-to-do listings for this place.'),
    spots(call, 'Yelp', EP.yelp, { query: { engine: 'yelp', find_loc: where, find_desc: req.food ?? 'Restaurants' }, maxAge: 86_400 }, parseYelp, 'Yelp has no listings here (its coverage outside North America and Europe is thin).'),
  ]);
  // Google Events needs a point to search around; the top sight is a fair center.
  const center = topSpots.items.find((spot) => spot.lat !== undefined && spot.lng !== undefined);
  const eventsPromise = center
    ? call(EP.events, { body: [{ keyword: `events in ${req.name}`, location_coordinate: `${center.lat!.toFixed(4)},${center.lng!.toFixed(4)},20`, language_code: 'en', date_range: 'next_month' }], maxAge: 21_600 }, parseGoogleEvents)
    : Promise.resolve({ ok: false as const, reason: 'error' as const });

  // Venue-level social: the best-known sight's own posts, plus the place's.
  const venue = topSpots.items[0]?.name;
  const tag = fold(req.name);
  const venueTag = venue ? fold(venue) : '';
  const socialTasks: Promise<ResearchPost[] | 'budget' | 'error'>[] = [];
  const unwrap = async <T,>(promise: ReturnType<Caller>) => {
    const result = await promise;
    return result.ok ? (result.value as T) : result.reason;
  };
  if (/^[a-z0-9]{3,40}$/.test(tag)) {
    socialTasks.push(unwrap<ResearchPost[]>(call(EP.instagram, { body: { hashtag: tag }, maxAge: 3600 }, (json) => parseInstagram(json, req.name, names, now))));
  }
  if (venue && /^[a-z0-9]{3,40}$/.test(venueTag)) {
    socialTasks.push(unwrap<ResearchPost[]>(call(EP.instagram, { body: { hashtag: venueTag }, maxAge: 3600 }, (json) => parseInstagram(json, venue, [venue, req.name], now))));
  }
  const tiktokTasks = [
    unwrap<ResearchPost[]>(call(EP.tiktok, { body: { query: `${req.name} travel`, datePosted: 30, sortBy: 0 }, maxAge: 3600 }, (json) => parseTikTok(json, req.name, names, now))),
    ...(venue ? [unwrap<ResearchPost[]>(call(EP.tiktok, { body: { query: `${venue} ${req.name}`.slice(0, 80), datePosted: 30, sortBy: 0 }, maxAge: 3600 }, (json) => parseTikTok(json, venue, [venue], now)))] : []),
  ];
  const [igResults, ttResults, events] = await Promise.all([Promise.all(socialTasks), Promise.all(tiktokTasks), eventsPromise]);
  const social = (source: 'Instagram' | 'TikTok', results: (ResearchPost[] | 'budget' | 'error')[], limit: number): ResearchSection<ResearchPost> => {
    const posts = results.flatMap((result) => (Array.isArray(result) ? result : []));
    const seen = new Set<string>();
    const unique = posts.filter((post) => !seen.has(post.id) && seen.add(post.id)).slice(0, limit);
    if (unique.length) return section(source, 'ok', undefined, unique, new Date(now).toISOString());
    const failed = results.find((result) => !Array.isArray(result)) as 'budget' | 'error' | undefined;
    if (failed && results.every((result) => !Array.isArray(result))) return section(source, failed === 'budget' ? 'skipped' : 'unavailable', why(failed));
    return section(source, 'empty', `No recent ${source} posts that actually name ${req.name}.`, [], new Date(now).toISOString());
  };
  const tiktok = social('TikTok', ttResults, 8);
  tiktok.items = await withTikTokCovers(tiktok.items, deps.fetchImpl ?? fetch);

  const gems = hiddenGems([...topSpots.items, ...food.items, ...nightlife.items], new Set());
  const mapsFetched = topSpots.fetchedAt ?? food.fetchedAt ?? nightlife.fetchedAt;
  const eventsSection = !events.ok
    ? section<never>('Google Events', events.reason === 'budget' ? 'skipped' : 'unavailable', why(events.reason))
    : events.value === null
      ? section<never>('Google Events', 'unavailable', 'The events feed is down on the provider’s side right now.')
      : events.value.length
        ? section('Google Events', 'ok', undefined, events.value, events.fetchedAt)
        : section<never>('Google Events', 'empty', 'No listed events for the next month.', [], events.fetchedAt);

  return {
    topSpots: { ...topSpots, items: topSpots.items.slice(0, 10) },
    food: { ...food, items: food.items.slice(0, 10) },
    nightlife: { ...nightlife, items: nightlife.items.slice(0, 10) },
    hiddenGems: gems.length
      ? section('Google Maps', 'ok', 'Rated 4.6+ with 30–1,500 Google reviews: loved, not overrun.', gems, mapsFetched)
      : section<ResearchSpot>('Google Maps', mapsFetched ? 'empty' : 'unavailable', mapsFetched ? 'Nothing here met the rule (4.6+ with 30–1,500 Google reviews).' : UNAVAILABLE),
    tripadvisor,
    yelp,
    instagram: social('Instagram', igResults, 10),
    tiktok,
    events: eventsSection,
    spentMicro: budget.spent,
  };
}

async function researchFlights(route: NonNullable<ResearchRequest['flight']>, token: string, deps: ResearchDeps): Promise<FlightSection & { spentMicro: number }> {
  const now = deps.now?.() ?? Date.now();
  const budget = new Budget(Math.min(EP.flights.ceilingUsd * 1_000_000, dailyRemaining(now)));
  const call = makeCaller(token, budget, deps);
  const result = await call(EP.flights, {
    query: { engine: 'google_flights', departure_id: route.from, arrival_id: route.to, outbound_date: route.depart, return_date: route.return, type: '1', currency: 'USD', hl: 'en' },
    maxAge: 21_600,
  }, parseFlights);
  if (!result.ok) return { ...section('Google Flights', result.reason === 'budget' ? 'skipped' : 'unavailable', why(result.reason)), route, spentMicro: budget.spent };
  const { flights, link, typical } = result.value;
  return {
    ...(flights.length ? section('Google Flights', 'ok', undefined, flights, result.fetchedAt) : section('Google Flights', 'empty', 'No round trips found for these dates.', [], result.fetchedAt)),
    route, link, typical, spentMicro: budget.spent,
  };
}

export async function researchDestination(req: ResearchRequest, deps: ResearchDeps = {}): Promise<DestinationResearch> {
  const token = deps.token ?? process.env.TREG_TOKEN ?? '';
  const now = deps.now?.() ?? Date.now();
  const place = req.region ? `${req.name}, ${req.region}` : req.name;
  const generatedAt = new Date(now).toISOString();
  if (!token) return notConnected(place, generatedAt, req.flight);

  const placeKey = [fold(req.name), fold(req.region ?? ''), fold(req.food ?? ''), fold(req.scene ?? '')].join('|');
  let fresh = 0;
  const partsPromise = remember(placeCache, placeKey, now, async () => {
    const parts = await researchPlace(req, token, deps);
    fresh += parts.spentMicro;
    return parts;
  }, (parts) => parts.topSpots.status === 'ok');
  const flightsPromise: Promise<FlightSection> = req.flight
    ? remember(flightCache, Object.values(req.flight).join('|'), now, async () => {
      const { spentMicro, ...flights } = await researchFlights(req.flight!, token, deps);
      fresh += spentMicro;
      return flights;
    }, (flights) => flights.status === 'ok' || flights.status === 'empty')
    : Promise.resolve({ ...section('Google Flights', 'skipped', 'Add a home city with a known airport to see real fares.') });
  const [{ spentMicro: _spent, ...parts }, flights] = await Promise.all([partsPromise, flightsPromise]);
  void _spent;
  return { place, generatedAt, configured: true, spentUsd: fresh / 1_000_000, capUsd: CAP_MICRO / 1_000_000, ...parts, flights };
}

function notConnected(place: string, generatedAt: string, flight?: ResearchRequest['flight']): DestinationResearch {
  const note = 'Live research isn’t connected on this deployment.';
  const off = <T,>(source: ResearchSourceName) => section<T>(source, 'unavailable', note);
  return {
    place, generatedAt, configured: false, spentUsd: 0, capUsd: CAP_MICRO / 1_000_000,
    topSpots: off('Google Maps'), food: off('Google Maps'), nightlife: off('Google Maps'), hiddenGems: off('Google Maps'),
    tripadvisor: off('Tripadvisor'), yelp: off('Yelp'), instagram: off('Instagram'), tiktok: off('TikTok'),
    events: off('Google Events'), flights: { ...off<never>('Google Flights'), route: flight },
  };
}
