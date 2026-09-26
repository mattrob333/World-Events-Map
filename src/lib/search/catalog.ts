import { EVENTS } from '@/lib/data/events';
import { listOpportunities } from '@/lib/access';
import { listAllInspiration } from '@/lib/inspiration';
import { buildDestinationPulses, slugifyPlace } from '@/lib/pulse';
import type { PulseStatus } from '@/lib/pulse/types';
import { TRAVELER_PORTRAITS } from '@/lib/travelers';
import { TRIP_ROOM_FIXTURES } from '@/lib/trips/fixtures';

export const SEARCH_GROUPS = [
  'pages',
  'destinations',
  'events',
  'people',
  'circles',
  'access',
  'editorial',
  'saved',
] as const;

export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export interface SearchHit {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

export const SEARCH_GROUP_LABEL: Record<SearchGroup, string> = {
  pages: 'Pages',
  destinations: 'Destinations',
  events: 'Events',
  people: 'People',
  circles: 'Circles',
  access: 'Access',
  editorial: 'Editorial ideas',
  saved: 'Saved on this device',
};

/** Curated status in plain words. "Live" would read as a live data feed. */
const STATUS_WORDS: Record<PulseStatus, string> = {
  live: 'on now',
  heating_up: 'coming up',
  seasonal: 'seasonal',
  steady: 'year-round',
  cooling: 'past its peak',
};

function haystack(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function buildSearchCatalog(now?: string): SearchHit[] {
  const destinations = buildDestinationPulses(EVENTS, now);
  const destinationById = new Map(destinations.map((pulse) => [pulse.id, pulse]));
  const hits: SearchHit[] = [
    {
      id: 'page-now',
      group: 'pages',
      title: 'NOW',
      subtitle: "Tonight's scene — local brief",
      href: '/now',
      keywords: haystack('now', 'tonight', 'nearby', 'scene', 'local'),
    },
    {
      id: 'page-trips',
      group: 'pages',
      title: 'Trips',
      subtitle: 'The trips you started, and places you kept',
      href: '/trips',
      keywords: haystack('trips', 'my trips', 'saved', 'watched'),
    },
    {
      id: 'page-settings',
      group: 'pages',
      title: 'Settings',
      subtitle: 'Account, profile basics, privacy and data',
      href: '/settings',
      keywords: haystack('account', 'settings', 'privacy', 'sign out'),
    },
  ];

  for (const pulse of destinations) {
    hits.push({
      id: `dest-${pulse.slug}`,
      group: 'destinations',
      title: pulse.name,
      subtitle: `${pulse.country} · ${STATUS_WORDS[pulse.status]}`,
      href: `/destinations/${pulse.slug}`,
      keywords: haystack(pulse.name, pulse.country, pulse.whyNow, ...pulse.archetypes),
    });
  }

  for (const event of EVENTS) {
    hits.push({
      id: `event-${event.id}`,
      group: 'events',
      title: event.name,
      subtitle: `${event.city}, ${event.country}`,
      href: `/?event=${event.id}`,
      keywords: haystack(event.name, event.city, event.country, event.category, ...event.tags),
    });
  }

  for (const portrait of TRAVELER_PORTRAITS) {
    hits.push({
      id: `person-${portrait.person.handle}`,
      group: 'people',
      title: portrait.person.displayName,
      subtitle: `@${portrait.person.handle} · editorial portrait`,
      href: `/people/${portrait.person.handle}`,
      keywords: haystack(
        portrait.person.displayName,
        portrait.person.handle,
        portrait.person.homeLabel,
        ...portrait.interests,
      ),
    });
  }

  for (const trip of TRIP_ROOM_FIXTURES) {
    hits.push({
      id: `circle-${trip.id}`,
      group: 'circles',
      title: trip.name,
      subtitle: `${trip.destinationLabel} · sample trip room`,
      href: `/circles/${trip.id}`,
      keywords: haystack(trip.name, trip.destinationLabel, trip.travelMode),
    });
  }

  for (const offer of listOpportunities()) {
    hits.push({
      id: `access-${offer.id}`,
      group: 'access',
      title: offer.title,
      subtitle: `${offer.destinationLabel} · ${offer.sample ? 'sample · ' : ''}${offer.availabilityLabel}`,
      href: offer.href,
      keywords: haystack(offer.title, offer.subtitle, offer.providerName, offer.kind),
    });
  }

  for (const item of listAllInspiration()) {
    const pulse = destinationById.get(item.destinationId);
    const city = item.destinationId.split('|')[0] ?? '';
    const slug = pulse?.slug ?? slugifyPlace(city);
    hits.push({
      id: `insp-${item.id}`,
      group: 'editorial',
      title: item.title,
      subtitle: `${item.kind} · editorial board`,
      href: slug ? `/destinations/${slug}` : '/circles',
      keywords: haystack(item.title, item.subtitle, item.kind, item.category),
    });
  }

  return hits;
}

export function searchCatalog(query: string, catalog: SearchHit[] = buildSearchCatalog()): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return catalog.slice(0, 18);
  return catalog.filter((hit) => hit.keywords.includes(q) || hit.title.toLowerCase().includes(q)).slice(0, 32);
}
