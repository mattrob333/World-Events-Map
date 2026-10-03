'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { newTripId, type Level, type Reply, type VoteValue } from './share';
import type { TripWindow } from './window';

/**
 * The ski trip being planned on this device: when, who, the shortlist at each
 * level (ranges, resorts, weeks, things to do), and the votes that came back
 * from the people it was shared with. One trip at a time for now.
 */
export interface SkiPlanState {
  tripId: string | null;
  name: string;
  window: TripWindow | null;
  party: 'family' | 'crew';
  picks: Record<Level | 'scene', string[]>;
  /** Voter name → option key → vote. */
  votes: Record<string, Record<string, VoteValue>>;
  setWindow: (window: TripWindow) => void;
  setName: (name: string) => void;
  setParty: (party: 'family' | 'crew') => void;
  togglePick: (level: Level | 'scene', key: string) => void;
  /** The trip's id, made the first time it's shared. */
  ensureId: () => string;
  /** Add a reply's votes. False when the reply is for another trip. */
  importReply: (reply: Reply) => boolean;
  clearVotes: (voter: string) => void;
  reset: () => void;
}

const EMPTY_PICKS = { range: [], resort: [], week: [], scene: [] };
/** Most voters kept, so a flood of replies can't grow storage forever. */
const MAX_VOTERS = 12;

export const useSkiPlan = create<SkiPlanState>()(
  persist(
    (set, get) => ({
      tripId: null,
      name: 'Ski trip',
      window: null,
      party: 'crew',
      picks: EMPTY_PICKS,
      votes: {},
      setWindow: (window) => set({ window }),
      setName: (name) => set({ name: name.slice(0, 60) }),
      setParty: (party) => set({ party }),
      togglePick: (level, key) =>
        set((state) => {
          const list = state.picks[level];
          return { picks: { ...state.picks, [level]: list.includes(key) ? list.filter((item) => item !== key) : [...list, key].slice(-24) } };
        }),
      ensureId: () => {
        const existing = get().tripId;
        if (existing) return existing;
        const id = newTripId();
        set({ tripId: id });
        return id;
      },
      importReply: (reply) => {
        if (reply.tripId !== get().tripId) return false;
        set((state) => {
          const votes = { ...state.votes, [reply.by]: { ...(state.votes[reply.by] ?? {}), ...reply.votes } };
          const names = Object.keys(votes);
          if (names.length > MAX_VOTERS) delete votes[names[0]];
          return { votes };
        });
        return true;
      },
      clearVotes: (voter) =>
        set((state) => {
          const votes = { ...state.votes };
          delete votes[voter];
          return { votes };
        }),
      reset: () => set({ tripId: null, name: 'Ski trip', picks: EMPTY_PICKS, votes: {} }),
    }),
    {
      name: 'meridian.skiPlan.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ tripId, name, window, party, picks, votes }) => ({ tripId, name, window, party, picks, votes }),
    },
  ),
);

/** Love it, fine, not for us: how an option is doing across everyone who voted. */
export function tally(votes: SkiPlanState['votes'], key: string): { love: number; fine: number; no: number; total: number } {
  const out = { love: 0, fine: 0, no: 0, total: 0 };
  for (const ballot of Object.values(votes)) {
    const vote = ballot[key];
    if (vote === undefined) continue;
    out.total += 1;
    if (vote === 1) out.love += 1;
    else if (vote === 0) out.fine += 1;
    else out.no += 1;
  }
  return out;
}

/** One number to sort options by: a love counts 2, a fine 1, a no takes 2 away. */
export function standing(votes: SkiPlanState['votes'], key: string): number {
  const count = tally(votes, key);
  return count.love * 2 + count.fine - count.no * 2;
}

/** The default window: the heart of the coming northern season. */
export function defaultWindow(now: Date): TripWindow {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  // This year's window once it has passed is no use: roll to next season.
  const year = `${now.getFullYear()}-03-20` < today ? now.getFullYear() + 1 : now.getFullYear();
  return { from: `${year}-01-09`, to: `${year}-03-20`, nights: 5 };
}
