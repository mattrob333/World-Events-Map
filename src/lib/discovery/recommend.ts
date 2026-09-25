import { scoreEvent } from '@/lib/buzz/scoring';
import { addDays } from '@/lib/buzz/dates';
import type { TripType } from '@/lib/jev/contracts/feedItem';
import { inWheres, type Where } from '@/lib/geo/regions';
import type { WorldEvent } from '@/lib/types';
import { whyNow, type WhyNow } from './whyNow';

/** Which curated events can answer "best X right now". Absent types match nothing rather than everything. */
const MATCH: Partial<Record<TripType, (event: WorldEvent) => boolean>> = {
  ski: (e) => e.category === 'ski',
  surf: (e) => /\b(surf\w*|waves?|pipeline)\b/i.test(`${e.name} ${e.tags.join(' ')}`),
  beach: (e) => e.category === 'sailing' || /\b(beach\w*|coast\w*|island\w*|reef|caribbean|maldives)\b/i.test(e.tags.join(' ')),
  food: (e) => e.category === 'culinary',
  nightlife: (e) => e.category !== 'ski' && (e.category === 'music' || /\b(nightclubs?|clubbing|nightlife|party|parties|carnival)\b/i.test(e.tags.join(' '))),
  music: (e) => e.category === 'music',
  festivals: (e) => /\b(festival|carnival|fiesta)\b/i.test(`${e.name} ${e.tags.join(' ')}`),
  sports: (e) => ['motorsport', 'golf', 'tennis', 'equestrian', 'sailing'].includes(e.category),
  luxury: (e) => e.priceIndex >= 4,
  culture: (e) => ['art', 'cultural', 'design', 'film', 'fashion'].includes(e.category),
  adventure: (e) => ['nature', 'safari'].includes(e.category),
  outdoors: (e) => ['nature', 'safari'].includes(e.category),
  wellness: (e) => e.category === 'wellness',
  family: (e) => /\b(family|kids)\b/i.test(`${e.tags.join(' ')} ${e.accessNote}`),
};

/** Whether an event is the kind of trip asked for (any event when no kind was said). */
export function matchesTripType(event: WorldEvent, tripType: TripType | null): boolean {
  if (!tripType) return true;
  const match = MATCH[tripType];
  return match ? match(event) : false;
}

export type Recommendation = {
  event: WorldEvent;
  why: WhyNow;
  buzz: number;
};

/**
 * "Where's best for X right now?" answered from the curated calendar only:
 * events of that kind on now or starting within the horizon, one per city,
 * ranked by buzz and then by how soon. Nothing is invented; an empty answer
 * is returned as empty.
 */
export function recommendDestinations(events: readonly WorldEvent[], today: string, tripType: TripType | null, options: { horizonDays?: number; limit?: number; within?: { from: string; to: string }; where?: readonly Where[] } = {}): Recommendation[] {
  const horizon = addDays(today, options.horizonDays ?? 150);
  const within = options.within;
  const where = options.where?.length ? options.where : null;
  const match = tripType ? MATCH[tripType] : undefined;
  if (tripType && !match) return [];
  const seen = new Set<string>();
  return events
    // A named month means the trip is in that month: starting in it, or running at least a week into it.
    .filter((event) => event.end >= today && (within ? event.start <= within.to && (event.start >= within.from || event.end >= addDays(within.from, 6)) : event.start <= horizon) && (!match || match(event)) && (!where || inWheres(event.country, where)))
    .map((event) => ({ event, why: whyNow(event, today), buzz: scoreEvent(event, { now: today }).score }))
    .sort((a, b) => b.buzz - a.buzz || a.event.start.localeCompare(b.event.start) || a.event.id.localeCompare(b.event.id))
    .filter(({ event }) => {
      const city = `${event.city}|${event.country}`;
      if (seen.has(city)) return false;
      seen.add(city);
      return true;
    })
    .slice(0, options.limit ?? 3);
}
