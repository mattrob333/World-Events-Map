/**
 * Live shows for a traveler's artists: the real artist on tour, and tribute
 * or cover acts playing their songs. Ticketmaster's Discovery API is the
 * source when configured; otherwise we hand back search links, never
 * invented listings.
 */

export type ConcertKind = 'artist' | 'tribute';

export type Concert = {
  id: string;
  kind: ConcertKind;
  artist: string;
  name: string;
  date: string;
  time?: string;
  venue?: string;
  city?: string;
  country?: string;
  url: string;
  image?: string;
  /** Ticketmaster's listed range at fetch time; indicative only. */
  price?: string;
};

export type ConcertSearch = { artists: string[]; city?: string; startDate?: string; endDate?: string };

export type ConcertResult = {
  source: 'ticketmaster' | 'links';
  fetchedAt: string;
  concerts: Concert[];
  links: { artist: string; label: string; href: string }[];
};

export const MAX_CONCERT_ARTISTS = 5;
const TRIBUTE = /tribute|cover|salute|experience|legacy|celebrat|revival|the music of|songs of/i;

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
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

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

/** Maps one Ticketmaster event, or null when it is not really this artist (or a tribute to them). */
export function toConcert(raw: unknown, artist: string, kind: ConcertKind): Concert | null {
  const event = obj(raw);
  if (!event) return null;
  const name = str(event.name);
  const id = str(event.id);
  const url = safeUrl(event.url, /(^|\.)(ticketmaster|livenation|universe|ticketweb)\.[a-z.]+$/i);
  const start = obj(obj(event.dates)?.start);
  const date = str(start?.localDate);
  if (!name || !id || !url || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const mentions = name.toLowerCase().includes(artist.toLowerCase());
  if (kind === 'artist' && !mentions) return null;
  if (kind === 'tribute' && !(mentions && TRIBUTE.test(name))) return null;
  if (kind === 'artist' && TRIBUTE.test(name)) return null;
  const venue = obj((obj(event._embedded)?.venues as unknown[] | undefined)?.[0]);
  const images = (Array.isArray(event.images) ? event.images : []).map(obj).filter(Boolean) as Obj[];
  const image = images
    .filter((img) => img.ratio === '16_9' || img.ratio === '3_2')
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))
    .map((img) => safeUrl(img.url, /(^|\.)(ticketm\.net|ticketmaster\.[a-z.]+)$/i))
    .find(Boolean);
  const range = obj((event.priceRanges as unknown[] | undefined)?.[0]);
  const min = Number(range?.min);
  const max = Number(range?.max);
  const currency = str(range?.currency);
  const price = Number.isFinite(min) && currency ? (Number.isFinite(max) && max > min ? `${currency} ${Math.round(min)}–${Math.round(max)}` : `${currency} ${Math.round(min)}+`) : undefined;
  return {
    id,
    kind,
    artist,
    name: name.slice(0, 140),
    date,
    time: str(start?.localTime)?.slice(0, 5),
    venue: str(venue?.name)?.slice(0, 80),
    city: str(obj(venue?.city)?.name)?.slice(0, 60),
    country: str(obj(venue?.country)?.countryCode)?.slice(0, 3),
    url,
    image,
    price,
  };
}

export async function searchTicketmaster(
  search: ConcertSearch,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Concert[]> {
  const artists = search.artists.slice(0, MAX_CONCERT_ARTISTS);
  const queries = artists.flatMap((artist) => [
    { artist, kind: 'artist' as const, keyword: artist },
    { artist, kind: 'tribute' as const, keyword: `${artist} tribute` },
  ]);
  const results = await Promise.all(
    queries.map(async ({ artist, kind, keyword }) => {
      const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json');
      const params: Record<string, string> = { apikey: apiKey, keyword, classificationName: 'music', sort: 'date,asc', size: '10' };
      if (search.city) params.city = search.city;
      if (search.startDate) params.startDateTime = `${search.startDate}T00:00:00Z`;
      if (search.endDate) params.endDateTime = `${search.endDate}T23:59:59Z`;
      url.search = new URLSearchParams(params).toString();
      try {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
        if (!response.ok) return [];
        const body = obj(await response.json());
        const events = (obj(body?._embedded)?.events as unknown[] | undefined) ?? [];
        return events.map((event) => toConcert(event, artist, kind)).filter((c): c is Concert => c !== null);
      } catch {
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  return results
    .flat()
    .filter((concert) => !seen.has(concert.id) && seen.add(concert.id))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 30);
}
