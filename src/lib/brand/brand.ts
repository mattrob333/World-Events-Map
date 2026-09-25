import { LOGOS, type LogoSlug } from './logos';

/** A source we can show a mark for: an official one from Simple Icons, or a plain monogram when there is none. */
export type Brand =
  | { kind: 'logo'; slug: LogoSlug; title: string; hex: string; path: string }
  | { kind: 'monogram'; slug: string; title: string; hex: string; letter: string };

/** Brands Simple Icons doesn't carry: a letter in the brand color, never an imitation of their logo. */
const MONOGRAMS: Record<string, { title: string; hex: string; letter: string }> = {
  opentable: { title: 'OpenTable', hex: '#DA3743', letter: 'O' },
  eventbrite: { title: 'Eventbrite', hex: '#F05537', letter: 'e' },
  vrbo: { title: 'Vrbo', hex: '#245ABC', letter: 'V' },
  resy: { title: 'Resy', hex: '#FF462D', letter: 'R' },
};

/** Hostname suffix → brand. Order matters: the more specific Google hosts come before google.*. */
const HOSTS: [RegExp, string][] = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)(reddit\.com|redd\.it)$/, 'reddit'],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/^(maps\.google\.[a-z.]+|maps\.app\.goo\.gl)$/, 'googlemaps'],
  [/^news\.google\.[a-z.]+$/, 'googlenews'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
  [/(^|\.)tripadvisor\.[a-z.]+$/, 'tripadvisor'],
  [/(^|\.)yelp\.[a-z.]+$/, 'yelp'],
  [/(^|\.)opentable\.[a-z.]+$/, 'opentable'],
  [/(^|\.)resy\.com$/, 'resy'],
  [/(^|\.)ticketmaster\.[a-z.]+$/, 'ticketmaster'],
  [/(^|\.)seatgeek\.com$/, 'seatgeek'],
  [/(^|\.)eventbrite\.[a-z.]+$/, 'eventbrite'],
  [/(^|\.)bandsintown\.com$/, 'bandsintown'],
  [/(^|\.)stubhub\.[a-z.]+$/, 'stubhub'],
  [/(^|\.)songkick\.com$/, 'songkick'],
  [/(^|\.)(commons\.wikimedia\.org|upload\.wikimedia\.org)$/, 'wikimediacommons'],
  [/(^|\.)wikipedia\.org$/, 'wikipedia'],
  [/(^|\.)spotify\.(com|link)$/, 'spotify'],
  [/(^|\.)uber\.com$/, 'uber'],
  [/(^|\.)lyft\.com$/, 'lyft'],
  [/(^|\.)airbnb\.[a-z.]+$/, 'airbnb'],
  [/(^|\.)booking\.com$/, 'bookingdotcom'],
  [/(^|\.)vrbo\.com$/, 'vrbo'],
  [/(^|\.)expedia\.[a-z.]+$/, 'expedia'],
  [/^podcasts\.apple\.com$/, 'applepodcasts'],
];

/** Names as they appear in labels and source ids ("Google Maps", "wikipedia", "tm"). */
const NAMES: [RegExp, string][] = [
  [/\byou\s?tube\b/, 'youtube'],
  [/\binstagram\b|\big\b/, 'instagram'],
  [/\btik\s?tok\b/, 'tiktok'],
  [/\btwitter\b|^x$|\bx\s?(posts?|api)\b/, 'x'],
  [/\breddit\b/, 'reddit'],
  [/\bfacebook\b/, 'facebook'],
  [/\bthreads\b/, 'threads'],
  [/\bgoogle\s?maps\b|\bgoogle\s?places\b|^places$/, 'googlemaps'],
  [/\bgoogle\s?news\b/, 'googlenews'],
  [/\bgoogle\b/, 'google'],
  [/\btrip\s?advisor\b/, 'tripadvisor'],
  [/\byelp\b/, 'yelp'],
  [/\bopen\s?table\b/, 'opentable'],
  [/\bresy\b/, 'resy'],
  [/\bticketmaster\b/, 'ticketmaster'],
  [/\bseat\s?geek\b/, 'seatgeek'],
  [/\beventbrite\b/, 'eventbrite'],
  [/\bbandsintown\b/, 'bandsintown'],
  [/\bstubhub\b/, 'stubhub'],
  [/\bsongkick\b/, 'songkick'],
  [/\b(wikimedia\s?)?commons\b|\bwikimedia\b/, 'wikimediacommons'],
  [/\bwikipedia\b/, 'wikipedia'],
  [/\bspotify\b/, 'spotify'],
  [/\buber\b/, 'uber'],
  [/\blyft\b/, 'lyft'],
  [/\bairbnb\b/, 'airbnb'],
  [/\bbooking(\.com)?\b/, 'bookingdotcom'],
  [/\bvrbo\b/, 'vrbo'],
  [/\bexpedia\b/, 'expedia'],
];

function make(slug: string): Brand | null {
  if (slug in LOGOS) {
    const logo = LOGOS[slug as LogoSlug];
    return { kind: 'logo', slug: slug as LogoSlug, ...logo };
  }
  const mono = MONOGRAMS[slug];
  return mono ? { kind: 'monogram', slug, ...mono } : null;
}

function hostOf(value: string): string | null {
  const text = value.trim().toLowerCase();
  if (!text || /\s/.test(text)) return null;
  try {
    const url = new URL(/^[a-z]+:\/\//.test(text) ? text : `https://${text}`);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (!host.includes('.')) return null;
    // Google Maps also lives under google.com/maps.
    if (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps')) return 'maps.google.com';
    return host;
  } catch {
    return null;
  }
}

/** The brand behind a URL, a hostname, or a source name; null when we don't know it (no guessing). */
export function brandFor(value: string | null | undefined): Brand | null {
  if (!value) return null;
  const host = hostOf(value);
  if (host) {
    const hit = HOSTS.find(([pattern]) => pattern.test(host));
    return hit ? make(hit[1]) : null;
  }
  const name = value.trim().toLowerCase();
  const hit = NAMES.find(([pattern]) => pattern.test(name));
  return hit ? make(hit[1]) : null;
}

/** Glyph color that reads on the brand color. */
export function glyphOn(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? '#0b0b0b' : '#ffffff';
}
