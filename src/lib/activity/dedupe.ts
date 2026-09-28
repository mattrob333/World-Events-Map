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

const NEAR_KM = 50;
/** Same-named events farther apart than this are different events (two cities' carnivals). */
const SAME_NAME_KM = 400;

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bthe\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * When a calendar beacon and an activity are the same event (the same name,
 * or within 50 km with overlapping dates), the globe shows only the activity
 * marker, which takes the beacon's heat (see `withHeat`). Everything else
 * passes through.
 */
export function dedupeBeacons(
  beacons: readonly Beacon[],
  events: ReadonlyMap<string, CalendarEventRef>,
  activities: readonly Activity[],
): { beacons: Beacon[]; heat: Map<string, number> } {
  const eventsWithDates = activities.filter((a) => a.kind === 'event');
  const heatFor = new Map<string, number>();
  const kept: Beacon[] = [];
  for (const beacon of beacons) {
    const ev = events.get(beacon.eventId);
    const match = ev
      ? eventsWithDates.find((a) => {
          const km = greatCircleDistanceKm({ lat: a.lat, lon: a.lng }, beacon.coords);
          if (norm(a.name) === norm(ev.name) && km <= SAME_NAME_KM) return true;
          if (!a.eventDates) return false;
          const overlap = a.eventDates.start <= ev.end && ev.start <= a.eventDates.end;
          return overlap && km <= NEAR_KM;
        })
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
