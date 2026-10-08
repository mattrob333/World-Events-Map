'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Where Now plans from instead of the phone: a hotel or an address they picked. */
export type PlanFrom = { name: string; address: string; lat: number; lng: number; utcOffsetMinutes?: number; timeZone?: string };

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
 * The place's UTC offset right now, in minutes. From its time zone when we
 * have one, so a pick saved before a daylight-saving change still reads the
 * right hour; otherwise the offset Google gave when they searched.
 */
export function offsetAt(place: Pick<PlanFrom, 'utcOffsetMinutes' | 'timeZone'> | null | undefined, now: Date): number | undefined {
  if (!place) return undefined;
  if (place.timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: place.timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(now);
      const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
      const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
      const offset = Math.round((wall - Math.floor(now.getTime() / 60_000) * 60_000) / 60_000);
      if (Number.isFinite(offset)) return offset;
    } catch {
      // An unknown zone falls back to the saved offset.
    }
  }
  return place.utcOffsetMinutes;
}

/**
 * The time where they'll be: a Date whose local fields (getHours, getDay…)
 * read the place's wall clock, from Google's UTC offset. With no offset, the
 * phone's own clock.
 */
export function clockAt(now: Date, utcOffsetMinutes?: number): Date {
  if (utcOffsetMinutes === undefined) return now;
  return new Date(now.getTime() + (utcOffsetMinutes + now.getTimezoneOffset()) * 60_000);
}
