import 'server-only';

import { SCENE_RULES, type SceneKey } from '@/lib/designer/scene';
import { reserve, type BudgetPool } from '@/lib/designer/server/dailyBudget';
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
 * Live research for any place, through Treg. One request makes at most eleven
 * paid calls, each with its own ceiling, and stops starting new calls once the
 * request's reserve would pass CAP_MICRO. Every call also reserves its
 * ceiling against the shared daily research budget (dailyBudget.ts) before it
 * is sent; that daily cap is per server instance until a durable store exists.
 *
 * Caching (per instance, in memory): the place itself (sights, Tripadvisor,
 * Yelp, social, events) is cached per place only. Only the two steered Google
 * Maps searches vary, and only by a small fixed set: the food search by a
 * cuisine from FOOD_TERMS and the nightlife search by a scene from
 * SCENE_RULES. Free text never reaches a cache key, so changing it cannot
 * force new paid runs. Flights are cached per route and dates.
 */

export const CAP_MICRO = 100_000; // $0.10 per research request (place parts)
const PLACE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_TTL_MS = 10 * 60 * 1000;
const MAX_CACHED = 200;

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

const PLACE_POOLS: BudgetPool[] = ['research', 'researchPlace'];
const FLIGHT_POOLS: BudgetPool[] = ['research', 'researchFlights'];

export type ResearchRequest = {
  name: string;
  region?: string;
  /** Favorite food, to steer the food search. Only FOOD_TERMS are used; anything else gets the default search. */
  food?: string;
  /** A music scene label ("Rock cover bands"), to steer the nightlife search. Only known scenes are used. */
  scene?: string;
  flight?: { from: string; to: string; depart: string; return: string };
};

export type ResearchDeps = {
  token?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  log?: (receipt: TregCallReceipt) => void;
};

/** Cuisines the food search can be steered by. Bounded on purpose: each one is a possible cache entry. */
export const FOOD_TERMS = [
  'street food', 'seafood', 'sushi', 'ramen', 'pizza', 'pasta', 'tapas', 'tacos', 'bbq', 'barbecue', 'steak', 'burgers',
  'dim sum', 'noodles', 'curry', 'pastries', 'bakery', 'brunch', 'coffee', 'wine bar', 'vegan', 'vegetarian',
  'italian', 'french', 'japanese', 'chinese', 'korean', 'thai', 'vietnamese', 'indian', 'mexican', 'middle eastern', 'greek', 'spanish', 'portuguese',
] as const;
export type FoodTerm = (typeof FOOD_TERMS)[number];

const words = (value: string) => ` ${value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Map free-text food to one FOOD_TERMS entry (first match), or undefined for the default search. */
export function foodTerm(food?: string): FoodTerm | undefined {
  if (!food) return undefined;
  const text = words(food);
  const hit = FOOD_TERMS.find((term) => text.includes(` ${term} `));
  return hit === 'barbecue' ? 'bbq' : hit;
}

/** Map a scene label or key to a known scene, or undefined for the default nightlife search. */
export function sceneKey(scene?: string): SceneKey | undefined {
  if (!scene) return undefined;
  const folded = fold(scene);
  const rules = Object.values(SCENE_RULES);
  const exact = rules.find((rule) => fold(rule.label) === folded || fold(rule.key) === folded);
  if (exact) return exact.key;
  return rules.find((rule) => rule.matches.test(scene))?.key;
}

const foodQuery = (term: FoodTerm | undefined) => (term ? `best ${term}` : 'best local restaurants');
const nightQuery = (key: SceneKey | undefined) => (key ? SCENE_RULES[key].searches[0] : 'live music bar');

/** Per-request reserve: stops a single request from starting calls past CAP_MICRO. */
class RunBudget {
  spent = 0;
  reserved = 0;
  constructor(readonly cap: number) {}
  take(micro: number): boolean {
    if (this.spent + this.reserved + micro > this.cap) return false;
    this.reserved += micro;
    return true;
  }
  settle(micro: number, costMicro: number | null) {
    this.reserved -= micro;
    // Unknown charge: count the ceiling so the cap stays conservative.
    this.spent += costMicro ?? micro;
  }
}

type Entry<T> = { expires: number; value: Promise<T> };
const coreCache = new Map<string, Entry<CoreParts>>();
const mapsCache = new Map<string, Entry<ResearchSection<ResearchSpot>>>();
const flightCache = new Map<string, Entry<FlightSection>>();

function fresh<T>(cache: Map<string, Entry<T>>, key: string, now: number): boolean {
  const hit = cache.get(key);
  return !(hit && hit.expires > now);
}

function remember<T>(cache: Map<string, Entry<T>>, key: string, now: number, make: () => Promise<T>, ok: (value: T) => boolean): Promise<T> {
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

type Keys = { core: string; food: string; night: string; flight?: string };

/** fold() drops non-Latin scripts entirely, so 東京 and Москва would share a key (review S2). */
function keyPart(value: string): string {
  return fold(value) || value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function cacheKeys(req: ResearchRequest): Keys {
  const place = `${keyPart(req.name)}|${keyPart(req.region ?? '')}`;
  return {
    core: place,
    food: `food|${place}|${foodTerm(req.food) ?? ''}`,
    night: `night|${place}|${sceneKey(req.scene) ?? ''}`,
    flight: req.flight ? [req.flight.from, req.flight.to, req.flight.depart, req.flight.return].join('|') : undefined,
  };
}

/**
 * How many of this request's parts would need fresh paid calls right now.
 * 0 means everything is cached (or in flight), so the route does not spend a
 * rate-limit token on it.
 */
export function researchCacheMisses(req: ResearchRequest, now = Date.now()): number {
  const keys = cacheKeys(req);
  return [fresh(coreCache, keys.core, now), fresh(mapsCache, keys.food, now), fresh(mapsCache, keys.night, now), keys.flight ? fresh(flightCache, keys.flight, now) : false]
    .filter(Boolean).length;
}

export function resetResearchCacheForTests() {
  coreCache.clear();
  mapsCache.clear();
  flightCache.clear();
}

const section = <T,>(source: ResearchSourceName, status: ResearchSection<T>['status'], note?: string, items: T[] = [], fetchedAt: string | null = null): ResearchSection<T> =>
  ({ status, source, fetchedAt, note, items });

type Reason = 'budget' | 'daily' | 'error';
type Caller = <T>(endpoint: Endpoint, request: { query?: Record<string, string>; body?: unknown; maxAge: number }, parse: (json: unknown, fetchedAt: string) => T) =>
  Promise<{ ok: true; value: T; fetchedAt: string } | { ok: false; reason: Reason }>;

function makeCaller(token: string, run: RunBudget, pools: BudgetPool[], deps: ResearchDeps): Caller {
  return async (endpoint, request, parse) => {
    const micro = Math.round(endpoint.ceilingUsd * 1_000_000);
    if (!run.take(micro)) return { ok: false, reason: 'budget' };
    // Reserve the ceiling against the shared day total before calling, so
    // concurrent requests can never together pass the daily cap.
    const daily = reserve(pools, micro, deps.now?.() ?? Date.now());
    if (!daily) {
      run.settle(micro, 0);
      return { ok: false, reason: 'daily' };
    }
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
      // A missing cost header (or a call that threw before a receipt) is
      // charged at the full ceiling: we assume it was billed.
      run.settle(micro, cost);
      daily.settle(cost);
    }
  };
}

const UNAVAILABLE = 'Couldn’t reach this source just now. Try again in a bit.';
const OVER_BUDGET = 'Skipped to stay under this trip’s research budget.';
const OVER_DAILY = 'Skipped: today’s live-research budget on this server is used up. It resets at midnight UTC.';
const why = (reason: Reason) => (reason === 'budget' ? OVER_BUDGET : reason === 'daily' ? OVER_DAILY : UNAVAILABLE);
// Run-budget skips stay "skipped"; a spent daily budget is shown as unavailable so the note is visible.
const statusFor = (reason: Reason) => (reason === 'budget' ? 'skipped' : 'unavailable');

type CoreParts = Pick<DestinationResearch, 'topSpots' | 'tripadvisor' | 'yelp' | 'instagram' | 'tiktok' | 'events'>;

async function spots(call: Caller, source: 'Google Maps' | 'Tripadvisor' | 'Yelp', endpoint: Endpoint, request: Parameters<Caller>[1], parse: (json: unknown) => ResearchSpot[], empty: string) {
  const result = await call(endpoint, request, (json) => parse(json));
  if (!result.ok) return section<ResearchSpot>(source, statusFor(result.reason), why(result.reason));
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

const where = (req: ResearchRequest) => (req.region ? `${req.name}, ${req.region}` : req.name);
const mapsRequest = (req: ResearchRequest, query: string) => ({ body: { query, location: where(req), limit: 12, language: 'en' }, maxAge: 86_400 });

/** The place itself: sights, Tripadvisor, Yelp, events and social. Depends only on name and region. */
async function researchCore(req: ResearchRequest, call: Caller, deps: ResearchDeps): Promise<CoreParts> {
  const now = deps.now?.() ?? Date.now();
  const names = [req.name];
  const [topSpots, tripadvisor, yelp] = await Promise.all([
    spots(call, 'Google Maps', EP.maps, mapsRequest(req, 'top attractions'), parseGoogleMaps, 'Google Maps returned no sights for this place.'),
    spots(call, 'Tripadvisor', EP.tripadvisor, { query: { engine: 'tripadvisor', q: where(req), ssrc: 'A' }, maxAge: 86_400 }, parseTripadvisor, 'Tripadvisor had no things-to-do listings for this place.'),
    spots(call, 'Yelp', EP.yelp, { query: { engine: 'yelp', find_loc: where(req), find_desc: 'Restaurants' }, maxAge: 86_400 }, parseYelp, 'Yelp has no listings here (its coverage outside North America and Europe is thin).'),
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
  const socialTasks: Promise<ResearchPost[] | Reason>[] = [];
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
  const social = (source: 'Instagram' | 'TikTok', results: (ResearchPost[] | Reason)[], limit: number): ResearchSection<ResearchPost> => {
    const posts = results.flatMap((result) => (Array.isArray(result) ? result : []));
    const seen = new Set<string>();
    const unique = posts.filter((post) => !seen.has(post.id) && seen.add(post.id)).slice(0, limit);
    if (unique.length) return section(source, 'ok', undefined, unique, new Date(now).toISOString());
    const failed = results.find((result) => !Array.isArray(result)) as Reason | undefined;
    if (failed && results.every((result) => !Array.isArray(result))) return section(source, statusFor(failed), why(failed));
    return section(source, 'empty', `No recent ${source} posts that actually name ${req.name}.`, [], new Date(now).toISOString());
  };
  const tiktok = social('TikTok', ttResults, 8);
  tiktok.items = await withTikTokCovers(tiktok.items, deps.fetchImpl ?? fetch);

  const eventsSection = !events.ok
    ? section<never>('Google Events', statusFor(events.reason), why(events.reason))
    : events.value === null
      ? section<never>('Google Events', 'unavailable', 'The events feed is down on the provider’s side right now.')
      : events.value.length
        ? section('Google Events', 'ok', undefined, events.value, events.fetchedAt)
        : section<never>('Google Events', 'empty', 'No listed events for the next month.', [], events.fetchedAt);

  return {
    topSpots: { ...topSpots, items: topSpots.items.slice(0, 10) },
    tripadvisor,
    yelp,
    instagram: social('Instagram', igResults, 10),
    tiktok,
    events: eventsSection,
  };
}

async function researchFlights(route: NonNullable<ResearchRequest['flight']>, call: Caller): Promise<FlightSection> {
  const result = await call(EP.flights, {
    query: { engine: 'google_flights', departure_id: route.from, arrival_id: route.to, outbound_date: route.depart, return_date: route.return, type: '1', currency: 'USD', hl: 'en' },
    maxAge: 21_600,
  }, parseFlights);
  if (!result.ok) return { ...section('Google Flights', statusFor(result.reason), why(result.reason)), route };
  const { flights, link, typical } = result.value;
  return {
    ...(flights.length ? section('Google Flights', 'ok', undefined, flights, result.fetchedAt) : section('Google Flights', 'empty', 'No round trips found for these dates.', [], result.fetchedAt)),
    route, link, typical,
  };
}

const answered = (s: { status: ResearchSection<unknown>['status'] }) => s.status === 'ok' || s.status === 'empty';

export async function researchDestination(req: ResearchRequest, deps: ResearchDeps = {}): Promise<DestinationResearch> {
  const token = deps.token ?? process.env.TREG_TOKEN ?? '';
  const now = deps.now?.() ?? Date.now();
  const place = where(req);
  const generatedAt = new Date(now).toISOString();
  if (!token) return notConnected(place, generatedAt, req.flight);

  const keys = cacheKeys(req);
  // What this request spends on fresh calls; parts served from cache (or
  // already in flight for another request) cost it nothing.
  const run = new RunBudget(CAP_MICRO);
  const flightRun = new RunBudget(Math.round(EP.flights.ceilingUsd * 1_000_000));
  const call = makeCaller(token, run, PLACE_POOLS, deps);

  const corePromise = remember(coreCache, keys.core, now, () => researchCore(req, call, deps), (core) => core.topSpots.status === 'ok');
  const foodPromise = remember(mapsCache, keys.food, now,
    () => spots(call, 'Google Maps', EP.maps, mapsRequest(req, foodQuery(foodTerm(req.food))), parseGoogleMaps, 'No restaurants came back for this place.'), answered);
  const nightPromise = remember(mapsCache, keys.night, now,
    () => spots(call, 'Google Maps', EP.maps, mapsRequest(req, nightQuery(sceneKey(req.scene))), parseGoogleMaps, 'No bars or venues came back for this place.'), answered);
  const flightsPromise: Promise<FlightSection> = req.flight && keys.flight
    ? remember(flightCache, keys.flight, now, () => researchFlights(req.flight!, makeCaller(token, flightRun, FLIGHT_POOLS, deps)), answered)
    : Promise.resolve({ ...section('Google Flights', 'skipped', 'Add a home city with a known airport to see real fares.') });

  const [core, food, nightlife, flights] = await Promise.all([corePromise, foodPromise, nightPromise, flightsPromise]);
  const gems = hiddenGems([...core.topSpots.items, ...food.items, ...nightlife.items], new Set());
  const mapsFetched = core.topSpots.fetchedAt ?? food.fetchedAt ?? nightlife.fetchedAt;
  return {
    place, generatedAt, configured: true,
    spentUsd: (run.spent + flightRun.spent) / 1_000_000,
    capUsd: CAP_MICRO / 1_000_000,
    ...core,
    food: { ...food, items: food.items.slice(0, 10) },
    nightlife: { ...nightlife, items: nightlife.items.slice(0, 10) },
    hiddenGems: gems.length
      ? section('Google Maps', 'ok', 'Rated 4.6+ with 30–1,500 Google reviews: loved, not overrun.', gems, mapsFetched)
      : section<ResearchSpot>('Google Maps', mapsFetched ? 'empty' : 'unavailable', mapsFetched ? 'Nothing here met the rule (4.6+ with 30–1,500 Google reviews).' : UNAVAILABLE),
    flights,
  };
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
