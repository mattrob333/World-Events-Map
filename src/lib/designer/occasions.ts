import { EVENTS } from '@/lib/data/events';
import { indexDestinations } from '@/lib/pulse/fromEvents';
import type { Occasion } from './tripIdeas';

let index: ReturnType<typeof indexDestinations> | null = null;

/** Curated calendar occasions, in the shape the trip-idea ranker uses, each with its page link. */
export function curatedOccasions(window: { startDate?: string; endDate?: string } = {}): Occasion[] {
  index ??= indexDestinations(EVENTS);
  return EVENTS.filter((event) => (!window.endDate || event.start <= window.endDate) && (!window.startDate || event.end >= window.startDate)).map((event) => {
    const destination = index!.byEventId.get(event.id);
    return {
      id: event.id,
      name: event.name,
      city: event.city,
      countryCode: event.countryCode,
      start: event.start,
      end: event.end,
      lat: event.coords.lat,
      lon: event.coords.lon,
      href: destination ? `/destinations/${destination.slug}?event=${encodeURIComponent(event.id)}` : `/?event=${encodeURIComponent(event.id)}`,
    };
  });
}
