import { EVENTS } from '@/lib/data/events';
import { orderShortlistEvents, selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';
import type { WorldEvent } from '@/lib/types';

/** The first editorial place uses the same seasonal ordering as the radar. */
export function editorialEventForMode(
  calendar: WorldEvent[],
  focus: string,
  season: TripSeason,
  interest: TripInterest,
): WorldEvent | undefined {
  return orderShortlistEvents(
    selectSeasonalEvents(calendar, focus, season, interest),
    interest,
  )[0];
}

/** A deliberate journey always takes precedence over the editorial default. */
export function resolveGlobeStory(
  selectedEventId: string | null,
  calendar: readonly WorldEvent[],
  editorial: WorldEvent | undefined,
): { event: WorldEvent | undefined; selected: boolean } {
  const chosen = selectedEventId
    ? calendar.find((event) => event.id === selectedEventId)
      ?? EVENTS.find((event) => event.id === selectedEventId)
    : undefined;

  return { event: chosen ?? editorial, selected: Boolean(chosen) };
}

/**
 * Distance to the spotlight only when it is also the nearest scene. An empty
 * search leaves both undefined, which must not read as a match.
 */
export function spotlightNearestDistance(
  nearby: readonly { event: WorldEvent; distanceKm: number }[],
  spotlight: WorldEvent | undefined,
): number | null {
  const nearest = nearby[0];
  return spotlight && nearest && nearest.event.id === spotlight.id ? nearest.distanceKm : null;
}
