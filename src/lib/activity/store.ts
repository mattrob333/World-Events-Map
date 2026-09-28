'use client';

import { create } from 'zustand';
import type { Category } from './activities';
import type { MonthSel } from './season';

/** The card's height on a phone; `panel` is the desktop side panel. */
export type SheetSnap = 'peek' | 'half' | 'full' | 'panel';

/**
 * The activity layer's UI state, and nothing else: which month and kinds are
 * showing, which card is open, and a request channel for opening a card from
 * outside the globe (search, deep links, the lists). Saves live in the intent
 * store and trips in the designer store, the one source of truth for each.
 */
export interface ActivityState {
  month: MonthSel;
  /** Empty means all categories. */
  categories: Category[];
  /** The For you chip: the profile's picks, instead of a category filter. */
  forYou: boolean;
  /** Spot whose card is open. Only one at a time. */
  selectedId: string | null;
  /** Spot the camera is flying to; the card opens when the flight ends. */
  pendingId: string | null;
  /** The open card's height, so the camera can keep the spot in the space above it. */
  snap: SheetSnap | null;
  /** Ask the layer to fly to a spot and open its card. */
  request: { id: string; seq: number } | null;
  requestSelect: (id: string) => void;
  setMonth: (m: MonthSel) => void;
  toggleCategory: (c: Category) => void;
  setCategories: (c: Category[]) => void;
  setForYou: (on: boolean) => void;
  setPending: (id: string | null) => void;
  openCard: (id: string) => void;
  closeCard: () => void;
  setSnap: (snap: SheetSnap | null) => void;
}

export const useActivityStore = create<ActivityState>()((set) => ({
  month: 'now',
  categories: [],
  forYou: false,
  selectedId: null,
  pendingId: null,
  snap: null,
  request: null,
  requestSelect: (id) => set((s) => ({ request: { id, seq: (s.request?.seq ?? 0) + 1 } })),
  setMonth: (month) => set({ month }),
  // Picking a kind leaves For you: the two are different ways in.
  toggleCategory: (c) =>
    set((s) => ({ forYou: false, categories: s.categories.includes(c) ? s.categories.filter((x) => x !== c) : [...s.categories, c] })),
  setCategories: (categories) => set({ categories, forYou: false }),
  setForYou: (forYou) => set({ forYou, categories: [] }),
  setPending: (pendingId) => set({ pendingId }),
  openCard: (id) => set({ selectedId: id, pendingId: null }),
  closeCard: () => set({ selectedId: null, pendingId: null, snap: null }),
  setSnap: (snap) => set({ snap }),
}));
