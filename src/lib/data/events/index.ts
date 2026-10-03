/**
 * dope.travel — the curated world calendar.
 *
 * Seventeen category files, one barrel. Every record is a real event at real
 * coordinates within the app's 14-month horizon (2026-07-26 → 2027-09-30).
 * Dates are the published schedule where a 2026/27 edition has been announced,
 * and the event's established annual window otherwise.
 *
 * Nothing downstream should import the category files directly — take EVENTS
 * or EVENT_INDEX from here so ordering and the id-uniqueness guard always run.
 */

import type { WorldEvent } from '@/lib/types';
import { rollForward } from './rollForward';

import { ART_EVENTS } from './art';
import { MUSIC_EVENTS } from './music';
import { MOTORSPORT_EVENTS } from './motorsport';
import { SAILING_EVENTS } from './sailing';
import { SKI_EVENTS } from './ski';
import { CULINARY_EVENTS } from './culinary';
import { FASHION_EVENTS } from './fashion';
import { WELLNESS_EVENTS } from './wellness';
import { SAFARI_EVENTS } from './safari';
import { EQUESTRIAN_EVENTS } from './equestrian';
import { FILM_EVENTS } from './film';
import { DESIGN_EVENTS } from './design';
import { GOLF_EVENTS } from './golf';
import { TENNIS_EVENTS } from './tennis';
import { NATURE_EVENTS } from './nature';
import { CULTURAL_EVENTS } from './cultural';
import { GALA_EVENTS } from './gala';
import { ELECTRONIC_EVENTS } from './electronic';

const ALL: WorldEvent[] = [
  ...ART_EVENTS,
  ...MUSIC_EVENTS,
  ...MOTORSPORT_EVENTS,
  ...SAILING_EVENTS,
  ...SKI_EVENTS,
  ...CULINARY_EVENTS,
  ...FASHION_EVENTS,
  ...WELLNESS_EVENTS,
  ...SAFARI_EVENTS,
  ...EQUESTRIAN_EVENTS,
  ...FILM_EVENTS,
  ...DESIGN_EVENTS,
  ...GOLF_EVENTS,
  ...TENNIS_EVENTS,
  ...NATURE_EVENTS,
  ...CULTURAL_EVENTS,
  ...GALA_EVENTS,
  ...ELECTRONIC_EVENTS,
];

/**
 * Ties are broken by `end` then `id` so the ordering is stable across builds —
 * the timeline scrubber and the beacon draw order both depend on it.
 */
function byDate(a: WorldEvent, b: WorldEvent): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1;
  if (a.end !== b.end) return a.end < b.end ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The day ended series are rolled forward from: the build's day (next.config
 * env CALENDAR_DAY), so the server render and every browser agree on the
 * calendar. Outside a Next build (tests, scripts) it's the current UTC day.
 * Between deploys an event that ends is hidden by the lists' own date checks
 * and rolls forward at the next deploy.
 */
export const CALENDAR_DAY = process.env.CALENDAR_DAY || new Date().toISOString().slice(0, 10);

/**
 * Every curated event, ascending by start date. A recurring event that has
 * ended is rolled to its next edition (projected dates, see rollForward), so
 * the calendar never loses the series.
 */
export const EVENTS: WorldEvent[] = ALL.map((event) => rollForward(event, CALENDAR_DAY)).sort(byDate);

/** O(1) lookup by event id. */
export const EVENT_INDEX: Map<string, WorldEvent> = new Map(
  EVENTS.map((e) => [e.id, e]),
);

// Duplicate ids would silently collapse EVENT_INDEX and desync the globe from
// the list, so fail loudly at module load — but only outside production, where
// a hard throw during render is worse than the bug it reports.
if (process.env.NODE_ENV !== 'production') {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const event of EVENTS) {
    if (seen.has(event.id)) duplicates.push(event.id);
    seen.add(event.id);
  }
  if (duplicates.length > 0) {
    throw new Error(
      `dope.travel dataset: duplicate event id(s) — ${[...new Set(duplicates)].join(', ')}`,
    );
  }
  if (EVENT_INDEX.size !== EVENTS.length) {
    throw new Error(
      `dope.travel dataset: EVENT_INDEX size ${EVENT_INDEX.size} !== EVENTS length ${EVENTS.length}`,
    );
  }
}

export { AIRPORTS } from './airports';
