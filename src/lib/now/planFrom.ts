'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Where Now plans from instead of the phone: a hotel or an address they picked. */
export type PlanFrom = { name: string; address: string; lat: number; lng: number; utcOffsetMinutes?: number };

type PlanFromState = { place: PlanFrom | null; set: (place: PlanFrom) => void; clear: () => void };

/**
 * The place Now plans from, kept on this device only (never sent to our
 * servers except as the rounded search point every Now scan uses).
 */
export const usePlanFrom = create<PlanFromState>()(
  persist(
    (set) => ({
      place: null,
      set: (place) => set({ place }),
      clear: () => set({ place: null }),
    }),
    { name: 'meridian.nowFrom.v1', storage: createJSONStorage(() => localStorage) },
  ),
);

/**
 * The time where they'll be: a Date whose local fields (getHours, getDay…)
 * read the place's wall clock, from Google's UTC offset. With no offset, the
 * phone's own clock.
 */
export function clockAt(now: Date, utcOffsetMinutes?: number): Date {
  if (utcOffsetMinutes === undefined) return now;
  return new Date(now.getTime() + (utcOffsetMinutes + now.getTimezoneOffset()) * 60_000);
}
