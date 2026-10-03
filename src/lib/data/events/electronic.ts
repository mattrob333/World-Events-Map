/**
 * dope.travel — the electronic music festival catalog.
 *
 * Every festival in electronic.json was researched from sources that were
 * opened and listed with it (official sites, ticketing, Resident Advisor,
 * press, Wikipedia): dates, venue, coordinates, nearest airport, genres and,
 * where published, capacity and ticket prices. Nothing is modeled: signals
 * are zero and there is no spend estimate (see WorldEvent.listing). When the
 * next edition's dates aren't announced, the festival sits in its usual
 * window and reads "Usually …, dates TBA" (datesStatus 'projected').
 *
 * Tier is editorial: the handful that define the scene are legendary; the
 * rest follow published capacity (40,000 or more is marquee), else insider.
 */

import type { EventTier, Recurrence, WorldEvent } from '@/lib/types';
import data from './electronic.json';

type Festival = {
  id: string;
  name: string;
  start: string;
  end: string;
  datesStatus: 'announced' | 'usual_window';
  confidence: 'high' | 'medium' | 'low';
  city: string;
  country: string;
  countryCode: string;
  venue: string;
  coords: [number, number];
  timezone: string;
  airport: { code: string; name: string; coords: [number, number] };
  capacity: number | null;
  capacityNote: string;
  genres: string[];
  ticketFrom: string | null;
  recurrence: Recurrence;
  description: string;
  researchNote: string;
  officialUrl: string;
  sources: string[];
};

export const FESTIVALS = data as Festival[];

/** The festivals that define the scene, whatever their published capacity. */
const LEGENDARY = new Set([
  'amsterdam-dance-event', 'edc-las-vegas', 'sonar-barcelona', 'creamfields', 'awakenings-festival',
  'defqon-1', 'movement-music-festival', 'ultra-europe', 'untold', 'time-warp-germany', 'dekmantel-festival', 'zamna-tulum',
]);

const ACRONYMS = new Set(['edm', 'dnb', 'idm']);
const sentence = (words: string[]) => (words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : words[0] ?? '');
const upper = (genre: string) => (ACRONYMS.has(genre.toLowerCase()) ? genre.toUpperCase() : genre.toLowerCase());
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '')}…`);
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function tierOf(festival: Festival): EventTier {
  if (LEGENDARY.has(festival.id)) return 'legendary';
  return (festival.capacity ?? 0) >= 40_000 ? 'marquee' : 'insider';
}

/** A venue we can name; "Multiple venues" or an undisclosed site reads "Venue to be announced". */
const namedVenue = (venue: string) => (/not (?:published|disclosed)|multiple|various|tbc|tba/i.test(venue) ? [] : [venue]);

export function festivalEvent(festival: Festival): WorldEvent {
  const genres = festival.genres.map(upper);
  const music = sentence(genres.slice(0, 3));
  const domain = new URL(festival.officialUrl).hostname.replace(/^www\./, '');
  const why = [
    clip(`Music: ${genres.slice(0, 4).join(', ')}`, 80),
    clip(festival.capacity ? `About ${festival.capacity.toLocaleString('en-US')} people${/per day|a day|daily/i.test(festival.capacityNote) ? ' a day' : ''}` : `${festival.city}, ${festival.country}`, 80),
    festival.datesStatus === 'announced' ? 'Dates announced by the organizer' : 'Next dates not announced yet; its usual window is shown',
    ...(festival.ticketFrom ? [clip(`Tickets: ${festival.ticketFrom}`, 80)] : []),
  ];
  return {
    id: festival.id,
    name: festival.name,
    tagline: clip(`${cap(music)} in ${festival.city}`, 90),
    category: 'music',
    city: festival.city,
    country: festival.country,
    countryCode: festival.countryCode,
    coords: { lat: festival.coords[0], lon: festival.coords[1] },
    timezone: festival.timezone,
    start: festival.start,
    end: festival.end,
    recurrence: festival.recurrence,
    ...(festival.datesStatus === 'usual_window' ? { datesStatus: 'projected' as const } : {}),
    tier: tierOf(festival),
    priceIndex: 2,
    estimatedSpend: { min: 0, max: 0, currency: 'USD' },
    accessNote: `Tickets through the official site, ${domain}.${festival.ticketFrom ? ` Published prices: ${festival.ticketFrom}.` : ''}`,
    venues: namedVenue(festival.venue),
    nearestJetPort: { code: festival.airport.code, name: festival.airport.name, coords: { lat: festival.airport.coords[0], lon: festival.airport.coords[1] }, fboQuality: 'adequate' },
    description: `${festival.description}${festival.description.length < 120 ? ` The music runs to ${music}.` : ''}`,
    whyGo: why,
    tags: [...new Set(['electronic', 'festival', ...festival.genres.map(slug)])].filter(Boolean),
    signals: { socialMentions: 0, socialVelocity: 0, searchInterest: 0, mediaMentions: 0, bookingPressure: 0, exclusivity: 0 },
    listing: { officialUrl: festival.officialUrl, sources: festival.sources, ticketFrom: festival.ticketFrom, capacity: festival.capacity },
  };
}

export const ELECTRONIC_EVENTS: WorldEvent[] = FESTIVALS.map(festivalEvent);
