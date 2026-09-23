'use client';

import { create } from 'zustand';
import type { TimelineWindow } from '@/lib/types';

/** Days either side of the scrubber that count as "in view". */
export const DEFAULT_SPAN_DAYS = 10;

export const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

/** The calendar day where the viewer is, which can differ from the UTC day. */
export function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
};

export const daysBetween = (a: string, b: string): number =>
  Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );

interface TimelineState extends TimelineWindow {
  /** First selectable date on the scrubber */
  rangeStart: string;
  /** Last selectable date on the scrubber */
  rangeEnd: string;
  /** Auto-advancing through the year */
  playing: boolean;
  /** Days advanced per second while playing */
  playSpeed: number;
  /** True while the user is actively dragging — suppresses camera flights */
  scrubbing: boolean;

  setFocus: (iso: string) => void;
  nudge: (days: number) => void;
  setSpan: (days: number) => void;
  setScrubbing: (v: boolean) => void;
  togglePlay: () => void;
  setPlaySpeed: (v: number) => void;
  reset: () => void;
  syncLocalToday: () => void;
}

/**
 * The scrubber spans a rolling 14 months from today: far enough out to plan a
 * season, not so far that the data becomes fiction.
 */
const today = toISODate(new Date());
const rangeStart = today;
const rangeEnd = addDays(today, 425);

const clamp = (iso: string, start: string, end: string) => {
  if (iso < start) return start;
  if (iso > end) return end;
  return iso;
};

export const useTimelineStore = create<TimelineState>((set, get) => ({
  focus: today,
  spanDays: DEFAULT_SPAN_DAYS,
  rangeStart,
  rangeEnd,
  playing: false,
  playSpeed: 6,
  scrubbing: false,

  setFocus: (iso) => set((state) => ({ focus: clamp(iso, state.rangeStart, state.rangeEnd) })),
  nudge: (days) => set((state) => ({ focus: clamp(addDays(state.focus, days), state.rangeStart, state.rangeEnd) })),
  setSpan: (days) => set({ spanDays: Math.max(1, Math.min(90, days)) }),
  setScrubbing: (scrubbing) => set({ scrubbing }),
  togglePlay: () => set((s) => ({ playing: !s.playing })),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),
  reset: () => set((state) => ({ focus: state.rangeStart, spanDays: DEFAULT_SPAN_DAYS, playing: false })),
  syncLocalToday: () => {
    const localToday = calendarDateInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (get().rangeStart === localToday) return;
    set((state) => ({
      rangeStart: localToday,
      rangeEnd: addDays(localToday, 425),
      focus: state.focus === state.rangeStart ? localToday : state.focus,
    }));
  },
}));
