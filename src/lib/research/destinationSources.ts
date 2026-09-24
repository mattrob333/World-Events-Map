/**
 * Destination research: normalizers for the Treg catalog endpoints the trip
 * canvas reads. Everything here is pure so it can be tested against recorded
 * provider shapes. A row is kept only when it carries a real link on the
 * provider's own domain; images are kept only from that provider's CDN, so
 * a picture always belongs to the listing or post it sits on.
 */

export type ResearchSourceName = 'Google Maps' | 'Tripadvisor' | 'Yelp' | 'Instagram' | 'TikTok' | 'Google Events' | 'Google Flights';
export type SectionStatus = 'ok' | 'empty' | 'unavailable' | 'skipped';

export type ResearchImage = { url: string; alt: string };

export type ResearchSpot = {
  id: string;
  name: string;
  source: 'Google Maps' | 'Tripadvisor' | 'Yelp';
  url: string;
  rating?: number;
  reviews?: number;
  category?: string;
  address?: string;
  price?: string;
  snippet?: string;
  image?: ResearchImage;
  lat?: number;
  lng?: number;
};

export type ResearchPost = {
  id: string;
  platform: 'Instagram' | 'TikTok';
  url: string;
  author: string;
  caption: string;
  publishedAt: string;
  /** What the post was found for: the place itself or one of its spots. */
  about: string;
  location?: string;
  views?: number;
  image?: ResearchImage;
};

export type ResearchEvent = { id: string; title: string; url: string; when: string; venue?: string; image?: ResearchImage };

export type ResearchFlight = {
  id: string;
  price: number;
  airlines: string[];
  stops: number;
  durationMin: number;
  from: string;
  to: string;
  departs: string;
};

export type ResearchSection<T> = {
  status: SectionStatus;
  source: ResearchSourceName;
  /** When the provider answered; null when nothing was fetched. */
  fetchedAt: string | null;
  /** Plain-language reason for an empty, skipped or unavailable section. */
  note?: string;
  items: T[];
};

export type FlightSection = ResearchSection<ResearchFlight> & {
  route?: { from: string; to: string; depart: string; return: string };
  link?: string;
  typical?: [number, number];
};

export type DestinationResearch = {
  place: string;
  generatedAt: string;
  configured: boolean;
  spentUsd: number;
  capUsd: number;
  topSpots: ResearchSection<ResearchSpot>;
  food: ResearchSection<ResearchSpot>;
  nightlife: ResearchSection<ResearchSpot>;
  hiddenGems: ResearchSection<ResearchSpot>;
  tripadvisor: ResearchSection<ResearchSpot>;
  yelp: ResearchSection<ResearchSpot>;
  instagram: ResearchSection<ResearchPost>;
  tiktok: ResearchSection<ResearchPost>;
  events: ResearchSection<ResearchEvent>;
  flights: FlightSection;
};

type Obj = Record<string, unknown>;
export const obj = (value: unknown): Obj | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Obj) : null;
const str = (value: unknown, max = 200): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim().replace(/\s+/g, ' ').slice(0, max) : undefined;
const num = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Accepts an https URL whose host is one of `hosts` (or a subdomain). Strips tracking. */
export function safeUrl(value: unknown, hosts: string[], keepQuery = false): string | undefined {
  const raw = str(value, 2000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
    if (!hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return undefined;
    if (!keepQuery) url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

/** Lowercase, accent-free, letters and digits only: "São Jorge" → "saojorge". */
export function fold(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

const foldWords = (value: string) => ` ${value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** True when `text` mentions `name` as whole words, ignoring accents and case. */
export function mentions(text: string | undefined, name: string): boolean {
  if (!text) return false;
  const needle = foldWords(name).trim();
  return needle.length >= 3 && foldWords(text).includes(` ${needle} `);
}

/* ---------------------------------------------------------------- places */

const GOOGLE_PHOTO_HOSTS = ['googleusercontent.com', 'ggpht.com'];

/** Google Maps thumbnails come sized in the URL; ask for a card-sized copy of the same photo. */
function googlePhoto(value: unknown): string | undefined {
  const url = safeUrl(value, GOOGLE_PHOTO_HOSTS, true);
  return url?.replace(/=w\d+-h\d+(-[a-z-]+)?$/, '=w480-h360-k-no');
}

export function parseGoogleMaps(json: unknown): ResearchSpot[] {
  const items = list(obj(obj(obj(json)?.output)?.data)?.items);
  const spots: ResearchSpot[] = [];
  for (const raw of items.slice(0, 20)) {
    const row = obj(raw);
    if (!row || row.permanentlyClosed === true) continue;
    const name = str(row.name, 120);
    const url = safeUrl(row.url, ['google.com'], false) && str(row.url, 2000);
    const placeId = str(row.placeId, 200);
    if (!name || !url || !placeId) continue;
    const image = googlePhoto(row.image);
    spots.push({
      id: `gm:${placeId}`,
      name,
      source: 'Google Maps',
      // The Maps "data=" link is path-encoded; keep it whole so it opens the exact place.
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}&query_place_id=${encodeURIComponent(placeId)}`,
      rating: num(row.rating),
      reviews: num(row.reviewCount),
      category: str(row.category, 60),
      address: str(row.address, 160),
      image: image ? { url: image, alt: `${name}, photo from its Google Maps listing` } : undefined,
      lat: num(row.latitude),
      lng: num(row.longitude),
    });
  }
  return spots;
}

/**
 * Hidden gems, by a rule we can state: loved (4.6+) but not overrun
 * (30–1,500 Google reviews). Nothing here is editorial judgment.
 */
export function hiddenGems(spots: ResearchSpot[], exclude: Set<string>, limit = 8): ResearchSpot[] {
  const seen = new Set<string>();
  return spots
    .filter((spot) => spot.source === 'Google Maps' && (spot.rating ?? 0) >= 4.6 && (spot.reviews ?? 0) >= 30 && (spot.reviews ?? 0) <= 1500)
    .filter((spot) => !exclude.has(spot.id) && !seen.has(spot.id) && seen.add(spot.id))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0))
    .slice(0, limit);
}

/** Tripadvisor "Things to do": real sights only; bookable tour products are left out. */
export function parseTripadvisor(json: unknown): ResearchSpot[] {
  const places = list(obj(json)?.places);
  const spots: ResearchSpot[] = [];
  for (const raw of places.slice(0, 30)) {
    const row = obj(raw);
    if (!row || row.place_type !== 'ATTRACTION') continue;
    const name = str(row.title, 120);
    const url = safeUrl(row.link, ['tripadvisor.com']);
    const id = str(row.place_id, 40);
    if (!name || !url || !id) continue;
    const image = safeUrl(row.thumbnail, ['tripadvisor.com'], true);
    spots.push({
      id: `ta:${id}`,
      name,
      source: 'Tripadvisor',
      url,
      rating: num(row.rating),
      reviews: num(row.reviews),
      snippet: str(obj(row.highlighted_review)?.text, 200),
      image: image ? { url: image, alt: `${name}, photo from its Tripadvisor listing` } : undefined,
    });
  }
  return spots.slice(0, 10);
}

export function parseYelp(json: unknown): ResearchSpot[] {
  const results = list(obj(json)?.organic_results);
  const spots: ResearchSpot[] = [];
  for (const raw of results.slice(0, 10)) {
    const row = obj(raw);
    if (!row) continue;
    const name = str(row.title, 120);
    const url = safeUrl(row.link, ['yelp.com']);
    if (!name || !url) continue;
    const image = safeUrl(row.thumbnail, ['yelpcdn.com'], true);
    const categories = list(row.categories).map((category) => str(obj(category)?.title, 40)).filter(Boolean);
    spots.push({
      id: `yelp:${url.split('/biz/')[1] ?? name}`,
      name,
      source: 'Yelp',
      url,
      rating: num(row.rating),
      reviews: num(row.reviews),
      price: str(row.price, 8),
      category: categories.slice(0, 2).join(' · ') || undefined,
      address: str(row.neighborhoods, 80),
      snippet: str(row.snippet, 200)?.replace(/…$/, '…'),
      image: image ? { url: image, alt: `${name}, photo from its Yelp listing` } : undefined,
    });
  }
  return spots;
}

/* ---------------------------------------------------------------- social */

const MAX_POST_AGE_MS = 60 * 24 * 60 * 60 * 1000;

function postedAt(value: unknown, now: number): string | undefined {
  const seconds = num(value);
  if (seconds === undefined) return undefined;
  const millis = seconds * 1000;
  if (millis > now + 60 * 60_000 || now - millis > MAX_POST_AGE_MS) return undefined;
  return new Date(millis).toISOString();
}

const stripTags = (caption: string) => caption.replace(/[#@][\p{L}\p{N}_.]+/gu, ' ');

/**
 * Hashtag feeds are noisy (ads and unrelated posts ride popular tags), so a
 * post counts only when its tagged location or its words, not just its
 * hashtags, name the place.
 */
export function aboutPlace(caption: string, location: string | undefined, names: string[]): boolean {
  const words = stripTags(caption);
  return names.some((name) => mentions(location, name) || mentions(words, name));
}

export function parseInstagram(json: unknown, about: string, names: string[], now = Date.now()): ResearchPost[] {
  const posts = list(obj(obj(obj(json)?.output)?.data)?.posts);
  const kept: ResearchPost[] = [];
  for (const raw of posts.slice(0, 40)) {
    const row = obj(raw);
    if (!row || row.isAd === true || row.paidPartnership === true || row.private === true) continue;
    const url = safeUrl(row.url, ['instagram.com']);
    const author = str(row.username, 40)?.replace(/^@/, '');
    const caption = str(row.caption, 600);
    const publishedAt = postedAt(row.createdUtc, now);
    const location = str(row.locationName, 80);
    if (!url || !/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[\w-]+\/$/.test(url)) continue;
    if (!author || !/^[A-Za-z0-9._]{1,30}$/.test(author) || !caption || !publishedAt) continue;
    if (!aboutPlace(caption, location, names)) continue;
    const photo = list(row.media).map(obj).find((media) => media?.type === 'photo');
    const image = safeUrl(photo?.url, ['cdninstagram.com', 'fbcdn.net'], true);
    kept.push({
      id: `ig:${url.split('/').filter(Boolean).pop()}`,
      platform: 'Instagram',
      url,
      author,
      caption: caption.slice(0, 280),
      publishedAt,
      about,
      location,
      image: image ? { url: image, alt: `Instagram photo by @${author}` } : undefined,
    });
  }
  return kept.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function parseTikTok(json: unknown, about: string, names: string[], now = Date.now()): ResearchPost[] {
  const videos = list(obj(obj(obj(json)?.output)?.data)?.videos);
  const kept: ResearchPost[] = [];
  for (const raw of videos.slice(0, 30)) {
    const row = obj(raw);
    if (!row) continue;
    const author = str(row.author, 40)?.replace(/^@/, '');
    const id = str(row.id, 30);
    const caption = str(row.caption, 600);
    const publishedAt = postedAt(row.createdUtc, now);
    if (!author || !/^[A-Za-z0-9._]{2,30}$/.test(author) || !id || !/^\d{12,25}$/.test(id) || !caption || !publishedAt) continue;
    // TikTok search already matched the words; still require the place in the caption (hashtags count here).
    if (!names.some((name) => mentions(caption, name) || fold(caption).includes(fold(name)))) continue;
    kept.push({
      id: `tt:${id}`,
      platform: 'TikTok',
      url: `https://www.tiktok.com/@${author}/video/${id}`,
      author,
      caption: caption.slice(0, 280),
      publishedAt,
      about,
      views: num(row.views),
    });
  }
  return kept;
}

/** TikTok's public oEmbed gives each video's own cover image. */
export function tiktokThumbnail(json: unknown): string | undefined {
  return safeUrl(obj(json)?.thumbnail_url, ['tiktokcdn.com', 'tiktokcdn-us.com', 'tiktokcdn-eu.com'], true);
}

/* ---------------------------------------------------------------- events */

/**
 * DataForSEO Google Events. The documented item carries title, url,
 * event_dates and location_info; rows missing a link or a date are dropped.
 * Returns null when the provider reports the function itself failed.
 */
export function parseGoogleEvents(json: unknown): ResearchEvent[] | null {
  const task = obj(list(obj(json)?.tasks)[0]);
  if (!task || task.status_code !== 20000) return null;
  const items = list(obj(list(task.result)[0])?.items);
  const events: ResearchEvent[] = [];
  for (const raw of items.slice(0, 20)) {
    const row = obj(raw);
    if (!row || row.type !== 'event_item') continue;
    const title = str(row.title, 140);
    const url = httpsUrl(row.url);
    const dates = obj(row.event_dates);
    const when = str(dates?.displayed_dates, 80) ?? str(dates?.start_datetime, 40);
    if (!title || !url || !when) continue;
    const image = httpsUrl(row.image_url);
    events.push({
      id: `ev:${fold(title).slice(0, 40)}:${fold(when).slice(0, 20)}`,
      title,
      url,
      when,
      venue: str(obj(row.location_info)?.name, 100),
      image: image && /(^|\.)(gstatic|googleusercontent)\.com$/.test(new URL(image).hostname) ? { url: image, alt: `${title}, image from its Google Events listing` } : undefined,
    });
  }
  return events.slice(0, 10);
}

function httpsUrl(value: unknown): string | undefined {
  const raw = str(value, 2000);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/* --------------------------------------------------------------- flights */

export function parseFlights(json: unknown): { flights: ResearchFlight[]; link?: string; typical?: [number, number] } {
  const root = obj(json);
  const rows = [...list(root?.best_flights), ...list(root?.other_flights)];
  const flights: ResearchFlight[] = [];
  for (const [index, raw] of rows.slice(0, 12).entries()) {
    const row = obj(raw);
    const legs = list(row?.flights).map(obj).filter((leg): leg is Obj => Boolean(leg));
    const price = num(row?.price);
    const duration = num(row?.total_duration);
    if (!row || !legs.length || price === undefined || price <= 0 || duration === undefined) continue;
    const first = obj(legs[0].departure_airport);
    const last = obj(legs[legs.length - 1].arrival_airport);
    const from = str(first?.id, 4);
    const to = str(last?.id, 4);
    const departs = str(first?.time, 20);
    if (!from || !to || !departs) continue;
    const airlines = [...new Set(legs.map((leg) => str(leg.airline, 40)).filter((name): name is string => Boolean(name)))];
    flights.push({ id: `fl:${index}:${from}-${to}:${price}`, price, airlines, stops: legs.length - 1, durationMin: duration, from, to, departs });
  }
  const link = safeUrl(obj(root?.search_metadata)?.google_flights_url, ['google.com'], true);
  const range = list(obj(root?.price_insights)?.typical_price_range).map(num);
  const typical = range.length === 2 && range[0] !== undefined && range[1] !== undefined ? [range[0], range[1]] as [number, number] : undefined;
  return { flights: flights.sort((a, b) => a.price - b.price).slice(0, 4), link, typical };
}
