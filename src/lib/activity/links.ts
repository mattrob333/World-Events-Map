import type { Activity } from './activities';
import { parseDay, referenceDate, type MonthSel } from './season';

/**
 * Outbound links for an activity card: see it (social), book it (flights, stays,
 * tickets), and more info (official site, directions, Wikipedia, weather).
 *
 * Pure and client-safe. Official links come from the curated record; everything
 * else is a search or map URL built here. Every builder returns undefined when it
 * lacks the inputs for a real link, and every URL it returns is https.
 */

export interface SocialLink {
  url: string;
  /** True for the spot's own account, false for a hashtag or search page. */
  official: boolean;
}

export interface SeeItLinks {
  instagram?: SocialLink;
  tiktok?: SocialLink;
  youtube?: SocialLink;
}

export interface BookItOptions {
  /** IATA code of the traveler's home airport, e.g. "ATL". Ignored unless three letters. */
  homeAirport?: string;
  month: MonthSel;
  now: Date;
}

export interface BookItLinks {
  /** Google Flights search. */
  flights?: string;
  /** Booking.com search for the place, with dates. */
  stay?: string;
  /** Official tickets, pass or permit page. */
  tickets?: string;
  bookAheadNote?: string;
  /** "EGE 35 min, DEN 2 h". Undefined when no airports are listed. */
  airports?: string;
  /** The travel window the flight and stay links use, YYYY-MM-DD. */
  dates?: { start: string; end: string };
}

export interface MoreInfoOptions {
  /** IANA time zone for the spot. Without it, `localTime` is left out rather than guessed. */
  tz?: string;
}

export interface MoreInfoLinks {
  officialSite?: string;
  directions?: string;
  wikipedia?: string;
  /** The spot's local time, e.g. "3:42 PM". Only when a time zone is known. */
  localTime?: string;
  weather?: string;
  /** Cleaned hashtags, without '#'. */
  hashtags?: string[];
}

/** The input as a string when it's an absolute https URL with a host, else undefined. */
export function httpsUrl(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (!s || /\s/.test(s)) return undefined;
  try {
    const u = new URL(s);
    return u.protocol === 'https:' && u.hostname.includes('.') ? s : undefined;
  } catch {
    return undefined;
  }
}

const HASHTAG_RE = /^[\p{L}\p{N}_]{1,100}$/u;

/** Hashtags without '#', dropping anything that isn't a plain tag. */
export function cleanHashtags(tags: readonly string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t !== 'string') continue;
    const tag = t.trim().replace(/^#+/, '');
    if (HASHTAG_RE.test(tag) && !out.includes(tag)) out.push(tag);
  }
  return out;
}

function official(raw: string | undefined): SocialLink | undefined {
  const url = httpsUrl(raw);
  return url ? { url, official: true } : undefined;
}

function built(url: string): SocialLink | undefined {
  const ok = httpsUrl(url);
  return ok ? { url: ok, official: false } : undefined;
}

export function seeIt(a: Activity): SeeItLinks {
  const tag = cleanHashtags(a.hashtags)[0];
  const enc = tag ? encodeURIComponent(tag) : undefined;
  const query = [a.name, a.place].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).join(' ');
  return {
    instagram: official(a.links?.instagram) ?? (enc ? built(`https://www.instagram.com/explore/tags/${enc}/`) : undefined),
    tiktok: official(a.links?.tiktok) ?? (enc ? built(`https://www.tiktok.com/tag/${enc}`) : undefined),
    youtube:
      official(a.links?.youtube) ??
      (query ? built(`https://www.youtube.com/results?${new URLSearchParams({ search_query: query })}`) : undefined),
  };
}

const IATA_RE = /^[A-Z]{3}$/;

function iata(raw: string | undefined): string | undefined {
  const code = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return IATA_RE.test(code) ? code : undefined;
}

const pad = (n: number) => String(n).padStart(2, '0');
/** YYYY-MM-DD from a Date's local calendar day. */
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * The travel window for the book links, deterministic from the inputs:
 *  - an event with announced dates that hasn't ended: its own dates;
 *  - otherwise one week from the first Saturday on or after the selection's
 *    reference day (today for "now" or the current month, else the 1st of that
 *    month's next occurrence).
 */
export function travelWindow(a: Activity, month: MonthSel, now: Date): { start: string; end: string } {
  const ev = a.eventDates;
  if (ev) {
    const s = parseDay(ev.start), e = parseDay(ev.end);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s && e >= today) {
      return { start: isoDay(s), end: isoDay(e) };
    }
  }
  const ref = referenceDate(month, now);
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + ((6 - ref.getDay() + 7) % 7));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start: isoDay(start), end: isoDay(end) };
}

function placeLabel(a: Activity): string | undefined {
  const parts = [a.place, a.country].map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/** "EGE 35 min, DEN 2 h": listed airports, drive time only when the record states one. */
export function formatAirports(list: Activity['nearestAirports']): string | undefined {
  if (!Array.isArray(list)) return undefined;
  const parts = list.flatMap((ap) => {
    const code = iata(ap?.iata);
    if (!code) return [];
    const drive = typeof ap.driveTime === 'string' ? ap.driveTime.trim() : '';
    return [drive ? `${code} ${drive}` : code];
  });
  return parts.length ? parts.join(', ') : undefined;
}

/**
 * Stays go to Booking.com because its search URL takes documented `ss`, `checkin`
 * and `checkout` parameters, so the dates carry over. Google Hotels has no stable
 * public URL format for dates.
 */
export function bookIt(a: Activity, { homeAirport, month, now }: BookItOptions): BookItLinks {
  const dates = travelWindow(a, month, now);
  const place = placeLabel(a);
  const dest = a.nearestAirports?.map((ap) => iata(ap?.iata)).find(Boolean) ?? place;
  const home = iata(homeAirport);

  let flights: string | undefined;
  if (dest && dest !== home) {
    const q = `Flights ${home ? `from ${home} ` : ''}to ${dest} on ${dates.start} through ${dates.end}`;
    flights = httpsUrl(`https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`);
  }

  const stay = place
    ? httpsUrl(`https://www.booking.com/searchresults.html?${new URLSearchParams({ ss: place, checkin: dates.start, checkout: dates.end })}`)
    : undefined;

  const note = typeof a.bookAheadNote === 'string' ? a.bookAheadNote.trim() : '';
  return {
    flights,
    stay,
    tickets: httpsUrl(a.links?.tickets) ?? httpsUrl(a.ticketUrl),
    bookAheadNote: note || undefined,
    airports: formatAirports(a.nearestAirports),
    dates: flights || stay ? dates : undefined,
  };
}

function validCoords(a: Activity): boolean {
  return (
    typeof a.lat === 'number' && typeof a.lng === 'number' &&
    Number.isFinite(a.lat) && Number.isFinite(a.lng) &&
    Math.abs(a.lat) <= 90 && Math.abs(a.lng) <= 180
  );
}

/** The spot's local time in `tz`, e.g. "3:42 PM", or undefined for a missing or unknown zone. */
export function localTimeIn(tz: string | undefined, now: Date): string | undefined {
  if (!tz || Number.isNaN(now.getTime())) return undefined;
  try {
    // Newer ICU puts a narrow no-break space before AM/PM; plain space reads the same everywhere.
    return new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
      .format(now)
      .replace(/[\u202f\u00a0]/g, ' ');
  } catch {
    return undefined;
  }
}

export function moreInfo(a: Activity, now: Date, opts: MoreInfoOptions = {}): MoreInfoLinks {
  const coords = validCoords(a);
  const wiki =
    httpsUrl(a.links?.wikipedia) ??
    (Array.isArray(a.sources) ? a.sources.map(httpsUrl).find((u) => u && new URL(u).hostname === 'en.wikipedia.org') : undefined);
  const tags = cleanHashtags(a.hashtags);
  return {
    officialSite: httpsUrl(a.links?.officialSite),
    directions: coords ? httpsUrl(`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`) : undefined,
    wikipedia: wiki,
    localTime: localTimeIn(opts.tz, now),
    weather: coords ? httpsUrl(`https://weather.com/weather/today/l/${a.lat.toFixed(2)},${a.lng.toFixed(2)}`) : undefined,
    hashtags: tags.length ? tags : undefined,
  };
}
