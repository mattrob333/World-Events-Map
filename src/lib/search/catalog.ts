import { EVENTS } from '@/lib/data/events';
import { listOpportunities } from '@/lib/access';
import { listAllInspiration } from '@/lib/inspiration';
import { buildDestinationPulses } from '@/lib/pulse';
import { TRAVELER_PORTRAITS } from '@/lib/travelers';
import { TRIP_ROOM_FIXTURES } from '@/lib/trips/fixtures';

export const SEARCH_GROUPS = [
  'destinations',
  'events',
  'people',
  'circles',
  'access',
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
  destinations: 'Destinations',
  events: 'Events',
  people: 'People',
  circles: 'Circles',
  access: 'Access',
  saved: 'Saved',
};

function haystack(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function buildSearchCatalog(now?: string): SearchHit[] {
  const destinations = buildDestinationPulses(EVENTS, now);
  const hits: SearchHit[] = [];

  for (const pulse of destinations) {
    hits.push({
      id: `dest-${pulse.slug}`,
      group: 'destinations',
      title: pulse.name,
      subtitle: `${pulse.country} · ${pulse.status.replace('_', ' ')}`,
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
      subtitle: `${offer.destinationLabel} · ${offer.availabilityLabel}`,
      href: offer.href,
      keywords: haystack(offer.title, offer.subtitle, offer.providerName, offer.kind),
    });
  }

  for (const item of listAllInspiration()) {
    hits.push({
      id: `insp-${item.id}`,
      group: 'saved',
      title: item.title,
      subtitle: `${item.kind} · editorial board`,
      href: `/destinations/${item.destinationId.split('|')[0]?.replace(/[^a-z0-9]+/g, '-')}`,
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
