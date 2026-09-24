/**
 * "Right now" on a trip: which phase the trip is in, which day it is and
 * which slot is up, from the traveler's local clock. Pure, so the canvas and
 * the NOW page share one table.
 *
 * - Switch times come from each slot's own "HH:MM" (what the canvas shows).
 * - Times before 04:00 still belong to the previous day's night out.
 * - Day 0 is a travel day until arrival; the last day turns into the trip
 *   home at the transfer time. Neither claims "you're here" while in transit.
 */

import { SLOT_META, type SlotKind } from './catalog';
import type { Day, Itinerary, Slot } from './itinerary';

/** A night out runs until this hour of the next calendar day. */
export const NIGHT_ENDS_MINUTES = 4 * 60;
/** When the return transfer starts if the slot has no time of its own. */
export const DEFAULT_TRANSFER_MINUTES = 14 * 60;
/** How long after the transfer "Fly home" takes over, without a set time. */
const TRANSFER_TO_FLIGHT_MINUTES = 120;
/** Arrival on day 0 when neither the arrive slot nor a later slot has a time. */
const DEFAULT_ARRIVAL_MINUTES = 18 * 60;

const TRAVEL_KINDS: ReadonlySet<SlotKind> = new Set(['depart', 'flight', 'arrive']);

export function localIsoDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoDiffDays(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

/** "12:30" → 750. Anything else ("Early", "Travel") → undefined. */
export function parseSlotTime(time: string | undefined): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  if (!match) return undefined;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

export function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${Math.floor(wrapped / 60)}:${String(wrapped % 60).padStart(2, '0')}`;
}

/** Start of an on-the-ground slot: its own HH:MM, else the catalog default. */
function slotStart(slot: Slot): number | undefined {
  if (TRAVEL_KINDS.has(slot.kind)) return parseSlotTime(slot.time);
  return parseSlotTime(slot.time) ?? parseSlotTime(SLOT_META[slot.kind].time);
}

export type TripPhase = 'before' | 'travel-out' | 'on-ground' | 'travel-home' | 'after';

export type LiveMoment = {
  phase: 'travel-out' | 'on-ground' | 'travel-home';
  day: Day;
  current?: Slot;
  next?: Slot;
  /** When the current slot ends, only when the next slot shows a clock time. */
  until?: string;
  tonight: boolean;
};

export type TripMoment =
  | { phase: 'before'; daysUntil: number }
  | { phase: 'after'; daysAgo: number }
  | LiveMoment;

export function isLive(moment: TripMoment): moment is LiveMoment {
  return moment.phase === 'travel-out' || moment.phase === 'on-ground' || moment.phase === 'travel-home';
}

type Timed = { slot: Slot; start: number };

function pick(entries: Timed[], minutes: number): { current?: Timed; next?: Timed } {
  let current: Timed | undefined;
  let next: Timed | undefined;
  for (const entry of entries) {
    if (entry.start <= minutes) current = entry;
    else if (!next) next = entry;
  }
  return { current, next };
}

/**
 * Where the traveler is in the trip. Before 04:00 counts as the previous
 * day's late night (so 01:30 on day 3 is still day 2's night out).
 */
export function tripMoment(trip: Pick<Itinerary, 'days'>, now: Date): TripMoment {
  let date = localIsoDate(now);
  let minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < NIGHT_ENDS_MINUTES) {
    date = shiftIso(date, -1);
    minutes += 24 * 60;
  }
  const first = trip.days[0]?.date;
  const lastIndex = trip.days.length - 1;
  const last = trip.days[lastIndex]?.date;
  if (!first || !last || date < first) return { phase: 'before', daysUntil: first ? isoDiffDays(first, date) : 0 };
  if (date > last) return { phase: 'after', daysAgo: isoDiffDays(date, last) };
  const day = trip.days.find((entry) => entry.date === date) ?? trip.days[isoDiffDays(date, first)] ?? trip.days[0];
  const tonight = minutes >= 17 * 60;
  const slots = day.slots;

  if (day.index === 0) {
    const arriveAt = slots.findIndex((slot) => slot.kind === 'arrive');
    const after = slots.slice(arriveAt + 1).map((slot) => ({ slot, start: slotStart(slot) })).filter((e): e is Timed => e.start !== undefined);
    if (arriveAt >= 0) {
      const arrival = parseSlotTime(slots[arriveAt].time) ?? after[0]?.start ?? DEFAULT_ARRIVAL_MINUTES;
      if (minutes < arrival) {
        const flight = slots.find((slot) => slot.kind === 'flight') ?? slots.find((slot) => slot.kind === 'depart');
        return { phase: 'travel-out', day, current: flight, next: slots[arriveAt], tonight };
      }
    }
    return moment('on-ground', day, after, minutes, tonight);
  }

  if (day.index === lastIndex) {
    const depart = slots.find((slot) => slot.kind === 'depart');
    const flight = slots.find((slot) => slot.kind === 'flight');
    const transfer = depart ? (parseSlotTime(depart.time) ?? DEFAULT_TRANSFER_MINUTES) : undefined;
    const takeoff = flight ? (parseSlotTime(flight.time) ?? (transfer ?? DEFAULT_TRANSFER_MINUTES) + TRANSFER_TO_FLIGHT_MINUTES) : undefined;
    const entries: Timed[] = slots
      .filter((slot) => !TRAVEL_KINDS.has(slot.kind))
      .map((slot) => ({ slot, start: slotStart(slot) }))
      .filter((e): e is Timed => e.start !== undefined && (transfer === undefined || e.start < transfer));
    if (depart && transfer !== undefined) entries.push({ slot: depart, start: transfer });
    if (flight && takeoff !== undefined) entries.push({ slot: flight, start: takeoff });
    entries.sort((a, b) => a.start - b.start);
    const homeward = transfer ?? takeoff;
    const phase = homeward !== undefined && minutes >= homeward ? 'travel-home' : 'on-ground';
    return moment(phase, day, entries, minutes, tonight);
  }

  const entries = slots.map((slot) => ({ slot, start: slotStart(slot) })).filter((e): e is Timed => e.start !== undefined);
  return moment('on-ground', day, entries, minutes, tonight);
}

function moment(phase: LiveMoment['phase'], day: Day, entries: Timed[], minutes: number, tonight: boolean): LiveMoment {
  const { current, next } = pick(entries, minutes);
  const until = current && next && parseSlotTime(next.slot.time) !== undefined ? formatMinutes(next.start) : undefined;
  return { phase, day, current: current?.slot, next: next?.slot, until, tonight };
}

/** The switch table for a day with no trip attached, from the same slot times. */
const DAY_TABLE: SlotKind[] = ['morning', 'lunch', 'afternoon', 'apres', 'dinner', 'late'];

/**
 * The kind of plan that fits this hour, for "right now" ideas anywhere. Uses
 * the slot times the canvas shows; Après only exists on ski trips.
 */
export function slotForTime(now: Date, kind: 'ski' | 'beach' | 'city' = 'city'): SlotKind {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < NIGHT_ENDS_MINUTES) return 'late';
  let slot: SlotKind = 'morning';
  for (const entry of DAY_TABLE) {
    if (entry === 'apres' && kind !== 'ski') continue;
    if (parseSlotTime(SLOT_META[entry].time)! <= minutes) slot = entry;
  }
  return slot;
}

/** The slot a live trip is on, else the clock's slot. One table for both views. */
export function slotKindNow(moment: TripMoment | null, now: Date, kind: 'ski' | 'beach' | 'city' = 'city'): SlotKind {
  if (moment && isLive(moment) && moment.phase === 'on-ground') {
    const slot = moment.current ?? moment.next;
    if (slot && !TRAVEL_KINDS.has(slot.kind)) return slot.kind;
  }
  return slotForTime(now, kind);
}

/**
 * A Google Maps search link with the destination left out of the query, so
 * Maps searches around wherever the phone is. dope.travel sends no location.
 * Returns undefined for links that are not Maps searches.
 */
export function mapsNearYou(href: string, place: { name: string; region?: string }): { href: string; label: string } | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  if (url.hostname !== 'www.google.com' || !url.pathname.startsWith('/maps/search')) return undefined;
  const query = url.searchParams.get('query') ?? '';
  const strip = [place.name, place.region ?? '', ...(place.region ?? '').split(',')]
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
    .sort((a, b) => b.length - a.length);
  let near = query;
  for (const part of strip) near = near.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  near = near.replace(/[’']s\b/g, '').replace(/\s+/g, ' ').trim();
  if (!near || near === query.trim()) return undefined;
  return { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(near)}`, label: 'Maps search near you' };
}
