/**
 * Live music from real event providers: your artists on tour, festivals
 * whose lineup includes them, tribute and cover acts, and scene nights in
 * a city. Ticketmaster Discovery and SeatGeek are the sources when
 * configured; otherwise callers get search links, never invented listings.
 */

import { SCENE_RULES, type Scene, type SceneKey } from './scene';

export type EventKind = 'artist' | 'festival' | 'tribute' | 'scene';
export type EventSource = 'ticketmaster' | 'seatgeek';

export type LiveEvent = {
  id: string;
  source: EventSource;
  kind: EventKind;
  /** The traveler's artist this event is for (artist, festival, tribute). */
  artist?: string;
  scene?: SceneKey;
  name: string;
  date: string;
  time?: string;
  venue?: string;
  city?: string;
  country?: string;
  lat?: number;
  lon?: number;
  url: string;
  image?: string;
  /** Listed at fetch time; indicative only. */
  price?: string;
  /** Other acts on the bill (festivals). */
  lineup?: string[];
  /** Jev's 0–1 read of how well this fits the traveler, when it ran. */
  fit?: number;
};

/** Back-compat name used by the moodboard list. */
export type Concert = LiveEvent;

export type ConcertSearch = { artists: string[]; city?: string; startDate?: string; endDate?: string };

export type ConcertResult = {
  source: 'ticketmaster' | 'seatgeek' | 'mixed' | 'links';
  sources: EventSource[];
  fetchedAt: string;
  concerts: LiveEvent[];
  links: { artist: string; label: string; href: string }[];
};

export const MAX_CONCERT_ARTISTS = 5;
const TRIBUTE = /tribute|cover band|covers\b|salute|experience|legacy|celebrat|revival|the music of|songs of|a night of/i;
const FESTIVAL = /fest\b|festival|fest[ -]|carnival|weekender|jam\b/i;

export function concertLinks(artists: string[], city?: string): ConcertResult['links'] {
  return artists.flatMap((artist) => [
    { artist, label: `${artist} on Ticketmaster`, href: `https://www.ticketmaster.com/search?q=${encodeURIComponent(artist)}` },
    { artist, label: `${artist} tour dates on Bandsintown`, href: `https://www.bandsintown.com/search?search_term=${encodeURIComponent(artist)}` },
    {
      artist,
      label: `${artist} tribute acts${city ? ` near ${city}` : ''}`,
      href: `https://www.ticketmaster.com/search?q=${encodeURIComponent(`${artist} tribute${city ? ` ${city}` : ''}`)}`,
    },
  ]);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const coord = (v: unknown, limit: number): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= limit && n !== 0 ? n : undefined;
};

function safeUrl(value: unknown, hosts: RegExp): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && hosts.test(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

const includes = (haystack: string, needle: string) => haystack.toLowerCase().includes(needle.toLowerCase());

/**
 * Decides what an event is to this traveler, or null when it is not really
 * about their artist. `wanted` is the kind of search that found it.
 */
export function classify(name: string, lineup: string[], artist: string, wanted: 'artist' | 'tribute'): EventKind | null {
  const inName = includes(name, artist);
  const onBill = lineup.some((act) => act.toLowerCase() === artist.toLowerCase());
  const tribute = TRIBUTE.test(name) || lineup.some((act) => TRIBUTE.test(act) && includes(act, artist));
  if (wanted === 'tribute') return (inName || lineup.some((act) => includes(act, artist))) && tribute ? 'tribute' : null;
  if (tribute) return null;
  if (onBill && (FESTIVAL.test(name) || lineup.length >= 5)) return 'festival';
  return inName || onBill ? 'artist' : null;
}

// --- Ticketmaster -----------------------------------------------------------

function tmPrice(raw: Obj): string | undefined {
  const range = obj(arr(raw.priceRanges)[0]);
  const min = Number(range?.min);
  const max = Number(range?.max);
  const currency = str(range?.currency);
  if (!Number.isFinite(min) || !currency) return undefined;
  return Number.isFinite(max) && max > min ? `${currency} ${Math.round(min)}–${Math.round(max)}` : `${currency} ${Math.round(min)}+`;
}

/** Maps one Ticketmaster Discovery event. Links and images must stay on Ticketmaster hosts. */
export function fromTicketmaster(raw: unknown): Omit<LiveEvent, 'kind'> | null {
  const event = obj(raw);
  if (!event) return null;
  const name = str(event.name);
  const id = str(event.id);
  const url = safeUrl(event.url, /(^|\.)(ticketmaster|livenation|universe|ticketweb)\.[a-z.]+$/i);
  const start = obj(obj(event.dates)?.start);
  const date = str(start?.localDate);
  if (!name || !id || !url || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const embedded = obj(event._embedded);
  const venue = obj(arr(embedded?.venues)[0]);
  const location = obj(venue?.location);
  const image = arr(event.images)
    .map(obj)
    .filter((img): img is Obj => Boolean(img) && (img!.ratio === '16_9' || img!.ratio === '3_2'))
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))
    .map((img) => safeUrl(img.url, /(^|\.)(ticketm\.net|ticketmaster\.[a-z.]+)$/i))
    .find(Boolean);
  const lineup = arr(embedded?.attractions).map((a) => str(obj(a)?.name)).filter((a): a is string => Boolean(a)).slice(0, 40);
  return {
    id: `tm:${id}`,
    source: 'ticketmaster',
    name: name.slice(0, 140),
    date,
    time: str(start?.localTime)?.slice(0, 5),
    venue: str(venue?.name)?.slice(0, 80),
    city: str(obj(venue?.city)?.name)?.slice(0, 60),
    country: str(obj(venue?.country)?.countryCode)?.slice(0, 3),
    lat: coord(location?.latitude, 90),
    lon: coord(location?.longitude, 180),
    url,
    image,
    price: tmPrice(event),
    lineup: lineup.length ? lineup : undefined,
  };
}

/** Back-compat helper: one Ticketmaster event checked against one artist. */
export function toConcert(raw: unknown, artist: string, wanted: 'artist' | 'tribute'): LiveEvent | null {
  const base = fromTicketmaster(raw);
  if (!base) return null;
  const kind = classify(base.name, base.lineup ?? [], artist, wanted);
  return kind ? { ...base, kind, artist } : null;
}

// --- SeatGeek ---------------------------------------------------------------

/** Maps one SeatGeek event. Links stay on seatgeek.com, images on SeatGeek's CDN. */
export function fromSeatGeek(raw: unknown): (Omit<LiveEvent, 'kind'> & { festivalType: boolean }) | null {
  const event = obj(raw);
  if (!event) return null;
  const id = event.id;
  const name = str(event.title) ?? str(event.short_title);
  const url = safeUrl(event.url, /(^|\.)seatgeek\.com$/i);
  const local = str(event.datetime_local);
  const date = local?.slice(0, 10);
  if ((typeof id !== 'number' && typeof id !== 'string') || !name || !url || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const venue = obj(event.venue);
  const location = obj(venue?.location);
  const performers = arr(event.performers).map(obj).filter((p): p is Obj => Boolean(p));
  const lineup = performers.map((p) => str(p.name)).filter((p): p is string => Boolean(p)).slice(0, 40);
  const image = performers.map((p) => safeUrl(p.image, /(^|\.)seatgeek(images)?\.com$/i)).find(Boolean);
  const lowest = Number(obj(event.stats)?.lowest_price);
  const tbd = event.time_tbd === true;
  return {
    id: `sg:${id}`,
    source: 'seatgeek',
    name: name.slice(0, 140),
    date,
    time: tbd ? undefined : local?.slice(11, 16) || undefined,
    venue: str(venue?.name)?.slice(0, 80),
    city: str(venue?.city)?.slice(0, 60),
    country: str(venue?.country)?.slice(0, 3),
    lat: coord(location?.lat, 90),
    lon: coord(location?.lon, 180),
    url,
    image,
    price: Number.isFinite(lowest) && lowest > 0 ? `USD ${Math.round(lowest)}+` : undefined,
    lineup: lineup.length ? lineup : undefined,
    festivalType: str(event.type) === 'music_festival',
  };
}

// --- search -----------------------------------------------------------------

export type ProviderKeys = { ticketmaster?: string; seatgeek?: string };
type Query = { keyword?: string; city?: string; genre?: string; startDate?: string; endDate?: string; size?: number };

async function getJson(url: URL, fetchImpl: typeof fetch): Promise<Obj | null> {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
    if (!response.ok) return null;
    return obj(await response.json());
  } catch {
    return null;
  }
}

export async function ticketmasterQuery(query: Query, apiKey: string, fetchImpl: typeof fetch = fetch) {
  const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
  const params: Record<string, string> = { apikey: apiKey, classificationName: query.genre ?? 'music', sort: 'date,asc', size: String(query.size ?? 20) };
  if (query.keyword) params.keyword = query.keyword;
  if (query.city) params.city = query.city;
  params.startDateTime = `${query.startDate ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`;
  if (query.endDate) params.endDateTime = `${query.endDate}T23:59:59Z`;
  url.search = new URLSearchParams(params).toString();
  const body = await getJson(url, fetchImpl);
  return arr(obj(body?._embedded)?.events).map(fromTicketmaster).filter((e): e is NonNullable<typeof e> => e !== null);
}

export async function seatgeekQuery(query: Query, clientId: string, fetchImpl: typeof fetch = fetch) {
  const url = new URL('https://api.seatgeek.com/2/events');
  const params: Record<string, string> = { client_id: clientId, per_page: String(query.size ?? 20), sort: 'datetime_local.asc', 'taxonomies.name': 'concert' };
  if (query.keyword) params.q = query.keyword;
  if (query.city) params['venue.city'] = query.city;
  params['datetime_local.gte'] = query.startDate ?? new Date().toISOString().slice(0, 10);
  if (query.endDate) params['datetime_local.lte'] = `${query.endDate}T23:59:59`;
  url.search = new URLSearchParams(params).toString();
  const body = await getJson(url, fetchImpl);
  return arr(body?.events).map(fromSeatGeek).filter((e): e is NonNullable<typeof e> => e !== null);
}

function dedupe(events: LiveEvent[]): LiveEvent[] {
  // The same show often appears on both providers: keep the first per name + date + city.
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.name.toLowerCase().replace(/[^a-z0-9]/g, '')}|${event.date}|${(event.city ?? '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Tour dates, festivals, and tribute acts for a traveler's artists. */
export async function searchArtistEvents(search: ConcertSearch, keys: ProviderKeys, fetchImpl: typeof fetch = fetch): Promise<LiveEvent[]> {
  const artists = search.artists.slice(0, MAX_CONCERT_ARTISTS);
  const window = { city: search.city, startDate: search.startDate, endDate: search.endDate };
  const jobs: Promise<LiveEvent[]>[] = [];
  for (const artist of artists) {
    for (const wanted of ['artist', 'tribute'] as const) {
      const keyword = wanted === 'artist' ? artist : `${artist} tribute`;
      if (keys.ticketmaster) {
        jobs.push(
          ticketmasterQuery({ ...window, keyword }, keys.ticketmaster, fetchImpl).then((events) =>
            events.flatMap((event) => {
              const kind = classify(event.name, event.lineup ?? [], artist, wanted);
              return kind ? [{ ...event, kind, artist }] : [];
            }),
          ),
        );
      }
      if (keys.seatgeek) {
        jobs.push(
          seatgeekQuery({ ...window, keyword }, keys.seatgeek, fetchImpl).then((events) =>
            events.flatMap(({ festivalType, ...event }) => {
              let kind = classify(event.name, event.lineup ?? [], artist, wanted);
              if (kind === 'artist' && festivalType) kind = 'festival';
              return kind ? [{ ...event, kind, artist }] : [];
            }),
          ),
        );
      }
    }
  }
  const results = (await Promise.all(jobs)).flat();
  return dedupe(results).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 60);
}

/** Scene nights in one city: genre shows plus tribute and cover acts. */
export async function searchCityScene(
  input: { city: string; startDate?: string; endDate?: string; scenes: SceneKey[] },
  keys: ProviderKeys,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveEvent[]> {
  const scenes = input.scenes.slice(0, 3);
  const window = { city: input.city, startDate: input.startDate, endDate: input.endDate, size: 15 };
  const jobs: Promise<Omit<LiveEvent, 'kind'>[]>[] = [];
  for (const key of scenes) {
    const genre = SCENE_RULES[key]?.ticketmasterGenre;
    if (keys.ticketmaster && genre) jobs.push(ticketmasterQuery({ ...window, genre }, keys.ticketmaster, fetchImpl));
  }
  if (keys.ticketmaster) jobs.push(ticketmasterQuery({ ...window, keyword: 'tribute' }, keys.ticketmaster, fetchImpl));
  if (keys.seatgeek) {
    jobs.push(seatgeekQuery({ ...window, keyword: 'tribute' }, keys.seatgeek, fetchImpl));
    jobs.push(seatgeekQuery(window, keys.seatgeek, fetchImpl));
  }
  const all = (await Promise.all(jobs)).flat();
  const tagged: LiveEvent[] = all.flatMap((event) => {
    const text = `${event.name} ${(event.lineup ?? []).join(' ')}`;
    const tribute = TRIBUTE.test(text);
    const scene = scenes.find((key) => SCENE_RULES[key].matches.test(text));
    if (!scene && !tribute) return [];
    // A tribute that matches no scene stays unlabeled; Jev's fit score judges it.
    return [{ ...event, kind: tribute ? 'tribute' : 'scene', scene }];
  });
  return dedupe(tagged).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 40);
}

export type SceneResponse = {
  city: string;
  fetchedAt: string;
  sources: EventSource[];
  judged: boolean;
  scenes: (Omit<Scene, 'matches'> & { links: { label: string; href: string }[] })[];
  events: LiveEvent[];
};
