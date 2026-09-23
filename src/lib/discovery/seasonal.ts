import type { WorldEvent } from '@/lib/types';

export type TripSeason = 'all' | 'winter' | 'spring' | 'summer' | 'fall';
export type TripInterest = 'all' | 'ski' | 'coast' | 'adventure' | 'culture';

/** An editorial travel window, based on the event's start month. */
export function eventSeason(event: WorldEvent): Exclude<TripSeason, 'all'> {
  const month = Number(event.start.slice(5, 7));
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'fall';
}

export function matchesTripInterest(event: WorldEvent, interest: TripInterest): boolean {
  if (interest === 'all') return true;
  const categories = [event.category, ...(event.secondaryCategories ?? [])];
  const subject = `${event.name} ${event.tagline} ${event.tags.join(' ')}`.toLowerCase();
  const tags = event.tags.join(' ').toLowerCase();

  switch (interest) {
    case 'ski':
      return event.category === 'ski';
    case 'coast':
      return event.category === 'sailing' || /\b(beach\w*|coast\w*|surf\w*|snorkel\w*|diving|reef|manta|marine|waterfront)\b/.test(tags);
    case 'adventure':
      return categories.includes('nature') || categories.includes('safari') || /\b(desert|dune|dunes|expedition|paraglid|trek)\b/.test(subject);
    case 'culture':
      return categories.some((category) => ['cultural', 'culinary', 'art', 'music', 'design'].includes(category));
  }
}

/** Resort stay windows lead a ski trip shortlist; races remain on the departure board. */
export function isSkiTripWindow(event: WorldEvent): boolean {
  return event.category === 'ski' && event.recurrence === 'seasonal' && !event.tags.includes('skeleton');
}

export function orderShortlistEvents(events: WorldEvent[], interest: TripInterest): WorldEvent[] {
  if (interest !== 'ski') return events;
  return [...events.filter(isSkiTripWindow), ...events.filter((event) => !isSkiTripWindow(event))];
}

/** Future curated occasions only; never implies live snow, inventory, or pricing. */
export function selectSeasonalEvents(
  events: WorldEvent[],
  focus: string,
  season: TripSeason,
  interest: TripInterest,
): WorldEvent[] {
  return events.filter((event) =>
    event.end >= focus &&
    (season === 'all' || eventSeason(event) === season) &&
    matchesTripInterest(event, interest)
  );
}
