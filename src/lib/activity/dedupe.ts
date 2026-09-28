import { greatCircleDistanceKm } from '@/lib/geo/projection';
import type { Beacon } from '@/lib/types';
import type { Activity } from './activities';

/** A calendar event, as much of it as matching needs. */
export interface CalendarEventRef {
  id: string;
  name: string;
  start: string;
  end: string;
}

/** Same-named events farther apart than this are different events (two cities' carnivals). */
const SAME_EVENT_KM = 400;

/** Words that name a kind of event, not which one: "Bahrain Grand Prix" and "Bahrain GP" share only "bahrain". */
const GENERIC = new Set([
  'the', 'of', 'and', 'de', 'del', 'la', 'le', 'les', 'di', 'in', 'at', 'on', 'to', 'a',
  'festival', 'fest', 'fete', 'feria', 'fair', 'grand', 'prix', 'gp', 'formula', 'f1',
  'week', 'weekend', 'day', 'days', 'season', 'show', 'annual', 'international',
]);

export const normName = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const keyWords = (s: string) => new Set(normName(s).split(' ').filter((w) => w.length > 1 && !GENERIC.has(w) && !/^\d{4}$/.test(w)));

/**
 * Whether two event names name the same event: equal once normalized, or
 * sharing their key words (every key word of the shorter name, and two thirds
 * of all of them). Being nearby with overlapping dates is not enough: the
 * Verbier Festival and Montreux Jazz overlap by a day 46 km apart. When in
 * doubt both markers stay, which is the safe mistake.
 */
export function sameEventName(a: string, b: string): boolean {
  if (normName(a) === normName(b)) return true;
  const x = keyWords(a), y = keyWords(b);
  if (!x.size || !y.size) return false;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  const union = x.size + y.size - shared;
  return shared === Math.min(x.size, y.size) && shared / union >= 2 / 3;
}

/**
 * When a calendar beacon and an activity are the same event (their names
 * match and they are in the same place), the globe shows only the activity
 * marker, which takes the beacon's heat (see `withHeat`). Everything else
 * passes through.
 */
export function dedupeBeacons(
  beacons: readonly Beacon[],
  events: ReadonlyMap<string, CalendarEventRef>,
  activities: readonly Activity[],
): { beacons: Beacon[]; heat: Map<string, number> } {
  const eventActivities = activities.filter((a) => a.kind === 'event');
  const heatFor = new Map<string, number>();
  const kept: Beacon[] = [];
  for (const beacon of beacons) {
    const ev = events.get(beacon.eventId);
    const match = ev
      ? eventActivities.find(
          (a) => sameEventName(a.name, ev.name) && greatCircleDistanceKm({ lat: a.lat, lon: a.lng }, beacon.coords) <= SAME_EVENT_KM,
        )
      : undefined;
    if (!match) {
      kept.push(beacon);
      continue;
    }
    heatFor.set(match.id, Math.max(heatFor.get(match.id) ?? 0, Math.round(beacon.score)));
  }
  return { beacons: kept, heat: heatFor };
}

/** A stable string for a heat map, so callers can memoize on it. */
export const heatKey = (heat: ReadonlyMap<string, number>) =>
  [...heat].sort(([a], [b]) => a.localeCompare(b)).map(([id, h]) => `${id}:${h}`).join(',');

/** The activities with the matched beacons' heat, from a `heatKey` string. */
export function withHeat(activities: readonly Activity[], key: string): Activity[] {
  if (!key) return activities as Activity[];
  const heat = new Map(key.split(',').map((pair) => {
    const i = pair.lastIndexOf(':');
    return [pair.slice(0, i), Number(pair.slice(i + 1))] as const;
  }));
  return activities.map((a) => (heat.has(a.id) ? { ...a, heat: heat.get(a.id)! } : a));
}
