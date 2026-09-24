/**
 * "Right now" on a trip: which day it is and which slot is up, from the
 * traveler's local clock. Pure, so the canvas and NOW page share it.
 */

import type { SlotKind } from './catalog';
import type { Day, Itinerary, Slot } from './itinerary';

/** When each slot starts, in minutes after local midnight. */
const SLOT_START: Partial<Record<SlotKind, number>> = {
  morning: 8 * 60, lunch: 12 * 60, afternoon: 14 * 60, apres: 16 * 60, dinner: 19 * 60, late: 21 * 60 + 30,
};

export function localIsoDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export type TripMoment = { day: Day; current?: Slot; next?: Slot; tonight: boolean };

/** Null unless today's date is one of the trip's days. */
export function tripMoment(trip: Pick<Itinerary, 'days'>, now: Date): TripMoment | null {
  const today = localIsoDate(now);
  const day = trip.days.find((entry) => entry.date === today);
  if (!day) return null;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const timed = day.slots.filter((slot) => SLOT_START[slot.kind] !== undefined);
  let current: Slot | undefined;
  let next: Slot | undefined;
  for (const slot of timed) {
    if (SLOT_START[slot.kind]! <= minutes) current = slot;
    else if (!next) next = slot;
  }
  return { day, current, next, tonight: minutes >= 17 * 60 };
}


/** The kind of plan that fits this hour, for "right now" ideas anywhere. */
export function slotForTime(now: Date): SlotKind {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < 4 * 60) return 'late';
  if (minutes < 11 * 60 + 30) return 'morning';
  if (minutes < 14 * 60) return 'lunch';
  if (minutes < 16 * 60) return 'afternoon';
  if (minutes < 18 * 60 + 30) return 'apres';
  if (minutes < 21 * 60 + 30) return 'dinner';
  return 'late';
}
