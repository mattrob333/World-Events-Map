import type { WorldEvent } from '@/lib/types';
import { indexDestinations } from '@/lib/pulse';

export const IDEA_INTERESTS = [
  { id: 'all', label: 'For you' },
  { id: 'culture', label: 'Art & culture' },
  { id: 'table', label: 'Food & nights' },
  { id: 'outside', label: 'Open air' },
  { id: 'water', label: 'On the water' },
] as const;

export type IdeaInterest = (typeof IDEA_INTERESTS)[number]['id'];

const INTEREST_CATEGORIES: Record<Exclude<IdeaInterest, 'all'>, WorldEvent['category'][]> = {
  culture: ['art', 'cultural', 'design', 'film', 'fashion'],
  table: ['culinary', 'music', 'gala'],
  outside: ['ski', 'safari', 'nature', 'wellness', 'equestrian', 'golf', 'tennis'],
  water: ['sailing'],
};

export interface TravelIdea {
  eventId: string;
  eventName: string;
  eventCategory: WorldEvent['category'];
  destination: string;
  country: string;
  slug: string;
  start: string;
  end: string;
  tagline: string;
  whyGo: string[];
  relatedOccasions: number;
}

/** Deterministic editorial preview from the curated calendar. No personal or live inputs. */
export function recommendTravelIdeas(
  events: WorldEvent[],
  now: string,
  interest: IdeaInterest = 'all',
  limit = 3,
): TravelIdea[] {
  const { byEventId } = indexDestinations(events, now);
  const categories = interest === 'all' ? null : INTEREST_CATEGORIES[interest];
  const eligible = events
    .filter((event) => event.end >= now && (!categories || categories.includes(event.category)))
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const ideas: TravelIdea[] = [];

  for (const event of eligible) {
    const destination = byEventId.get(event.id);
    if (!destination || seen.has(destination.slug)) continue;
    seen.add(destination.slug);
    ideas.push({
      eventId: event.id,
      eventName: event.name,
      eventCategory: event.category,
      destination: destination.name,
      country: destination.country,
      slug: destination.slug,
      start: event.start,
      end: event.end,
      tagline: event.tagline,
      whyGo: event.whyGo.slice(0, 2),
      relatedOccasions: destination.eventIds.length,
    });
    if (ideas.length >= limit) break;
  }

  return ideas;
}
