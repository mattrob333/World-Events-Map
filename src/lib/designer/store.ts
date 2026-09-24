'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Itinerary } from './itinerary';
import type { ListeningProfile } from './listening';
import type { ParseEngine, TravelerProfile } from './profile';
import { isSafeId, mergeReply as mergeReplyInto, type MergeSummary, type TripReply } from './tripShare';
import { moveCard as moveCardBetween, type TripVotes } from './votes';

export type SavedProfile = {
  id: string;
  profile: TravelerProfile;
  engine: ParseEngine;
  updatedAt: string;
};

/** The trip a shared invite replaced on this device, kept so it can be restored. */
export type SavedTrip = { trip: Itinerary; votes: TripVotes; activeParticipant: string | null; joinedAs: string | null };

interface DesignerState {
  profiles: SavedProfile[];
  trip: Itinerary | null;
  votes: TripVotes;
  activeParticipant: string | null;
  /** On a guest copy: who this device joined as. Only their picks are sent back. */
  joinedAs: string | null;
  /** One slot: the trip an invite replaced. */
  previousTrip: SavedTrip | null;
  /** Per traveler id: the send time of the newest picks link merged into this trip. */
  lastMergedAt: Record<string, string>;
  /** In memory only: the state before the last merge, for Undo. */
  mergeUndo: { tripId: string; trip: Itinerary; votes: TripVotes; lastMergedAt: Record<string, string> } | null;
  /** Board in progress: survives the Spotify sign-in redirect. */
  draftRamble: string;
  draftListening: ListeningProfile | null;
  setDraftRamble: (text: string) => void;
  setDraftListening: (listening: ListeningProfile | null) => void;
  saveProfile: (profile: SavedProfile) => void;
  removeProfile: (id: string) => void;
  setTrip: (trip: Itinerary) => void;
  /**
   * Opens a shared trip on this device, keeping everyone's votes so far. A
   * different trip already here moves to `previousTrip` instead of being lost.
   */
  importTrip: (trip: Itinerary, votes: TripVotes, me: string) => void;
  /** Swaps the previous trip back in (the current one takes its slot). */
  restorePreviousTrip: () => void;
  /** Merges a friend's picks link; throws if it belongs to another trip. `as` merges into an existing traveler. */
  mergeReply: (reply: TripReply, options?: { as?: string }) => MergeSummary;
  /** Restores the trip and votes from before the last merge. */
  undoMerge: () => boolean;
  /** Renames a traveler (the organizer's "What should your crew see you as?"). */
  renameParticipant: (id: string, name: string) => void;
  clearTrip: () => void;
  setActiveParticipant: (id: string) => void;
  /** Toggles by default (tap again to clear); swipes pass toggle=false to set. */
  vote: (slotId: string, cardId: string, participantId: string, value: 1 | -1, toggle?: boolean) => void;
  moveCard: (cardId: string, fromSlot: string, toSlot: string, toIndex?: number) => void;
  pickCard: (slotId: string, cardId: string) => void;
  clearAll: () => void;
}

function slotMap(trip: Itinerary): Record<string, string[]> {
  return Object.fromEntries(trip.days.flatMap((day) => day.slots.map((slot) => [slot.id, slot.cardIds])));
}

function withSlots(trip: Itinerary, slots: Record<string, string[]>): Itinerary {
  return {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      slots: day.slots.map((slot) => (slots[slot.id] === slot.cardIds ? slot : { ...slot, cardIds: slots[slot.id] })),
    })),
  };
}

/**
 * Mood boards, the trip draft, and votes live on this device only. Group
 * voting across phones needs accounts and a shared table (not built yet), so
 * this store is the "pass the phone" version and says so in the UI.
 */
export const useDesignerStore = create<DesignerState>()(
  persist(
    (set, get) => ({
      profiles: [],
      trip: null,
      votes: {},
      activeParticipant: null,
      joinedAs: null,
      previousTrip: null,
      lastMergedAt: {},
      mergeUndo: null,
      draftRamble: '',
      draftListening: null,
      setDraftRamble: (draftRamble) => set({ draftRamble }),
      setDraftListening: (draftListening) => set({ draftListening }),
      saveProfile: (profile) =>
        set((state) => ({ profiles: [profile, ...state.profiles.filter((entry) => entry.id !== profile.id)].slice(0, 12) })),
      removeProfile: (id) => set((state) => ({ profiles: state.profiles.filter((entry) => entry.id !== id) })),
      setTrip: (trip) => set({ trip, votes: {}, activeParticipant: trip.participants[0]?.id ?? null, joinedAs: null, lastMergedAt: {}, mergeUndo: null }),
      importTrip: (trip, votes, me) =>
        set((state) => {
          const replacing = state.trip && state.trip.id !== trip.id;
          return {
            trip,
            votes,
            activeParticipant: me,
            joinedAs: trip.joinedFrom !== undefined ? me : null,
            ...(replacing
              ? {
                  previousTrip: { trip: state.trip!, votes: state.votes, activeParticipant: state.activeParticipant, joinedAs: state.joinedAs },
                  lastMergedAt: {},
                  mergeUndo: null,
                }
              : {}),
          };
        }),
      restorePreviousTrip: () =>
        set((state) => {
          if (!state.previousTrip) return {};
          const saved = state.previousTrip;
          return {
            trip: saved.trip,
            votes: saved.votes,
            activeParticipant: saved.activeParticipant,
            joinedAs: saved.joinedAs,
            previousTrip: state.trip ? { trip: state.trip, votes: state.votes, activeParticipant: state.activeParticipant, joinedAs: state.joinedAs } : null,
            lastMergedAt: {},
            mergeUndo: null,
          };
        }),
      mergeReply: (reply, options) => {
        const { trip, votes, lastMergedAt } = get();
        if (!trip) throw new Error('Open the trip on this device first, then tap the picks link again.');
        const merged = mergeReplyInto(trip, votes, reply, options);
        const who = merged.summary.participantId;
        const at = reply.at ?? new Date().toISOString();
        const known = Object.hasOwn(lastMergedAt, who) ? lastMergedAt[who] : undefined;
        const nextMerged = { ...lastMergedAt };
        if (isSafeId(who) && (!known || Date.parse(at) > Date.parse(known))) nextMerged[who] = at;
        set({ trip: merged.trip, votes: merged.votes, lastMergedAt: nextMerged, mergeUndo: { tripId: trip.id, trip, votes, lastMergedAt } });
        return merged.summary;
      },
      undoMerge: () => {
        const { mergeUndo, trip } = get();
        if (!mergeUndo || trip?.id !== mergeUndo.tripId) return false;
        set({ trip: mergeUndo.trip, votes: mergeUndo.votes, lastMergedAt: mergeUndo.lastMergedAt, mergeUndo: null });
        return true;
      },
      renameParticipant: (id, name) =>
        set((state) => {
          const clean = name.trim().slice(0, 30);
          if (!state.trip || !clean) return {};
          return { trip: { ...state.trip, participants: state.trip.participants.map((p) => (p.id === id ? { ...p, name: clean } : p)) } };
        }),
      clearTrip: () => set({ trip: null, votes: {}, activeParticipant: null, joinedAs: null, lastMergedAt: {}, mergeUndo: null }),
      setActiveParticipant: (id) => set({ activeParticipant: id }),
      vote: (slotId, cardId, participantId, value, toggle = true) =>
        set((state) => {
          const slot = { ...(state.votes[slotId] ?? {}) };
          const card = { ...(slot[cardId] ?? {}) };
          if (toggle && card[participantId] === value) delete card[participantId];
          else card[participantId] = value;
          slot[cardId] = card;
          return { votes: { ...state.votes, [slotId]: slot } };
        }),
      moveCard: (cardId, fromSlot, toSlot, toIndex = 0) => {
        const trip = get().trip;
        if (!trip) return;
        const slots = slotMap(trip);
        const next = moveCardBetween(slots, cardId, fromSlot, toSlot, toIndex);
        if (next === slots) return;
        set((state) => {
          if (fromSlot === toSlot) return { trip: withSlots(trip, next) };
          // Votes follow the card to its new slot.
          const fromVotes = { ...(state.votes[fromSlot] ?? {}) };
          const moved = fromVotes[cardId];
          delete fromVotes[cardId];
          const toVotes = { ...(state.votes[toSlot] ?? {}), ...(moved ? { [cardId]: moved } : {}) };
          return { trip: withSlots(trip, next), votes: { ...state.votes, [fromSlot]: fromVotes, [toSlot]: toVotes } };
        });
      },
      pickCard: (slotId, cardId) => get().moveCard(cardId, slotId, slotId, 0),
      clearAll: () =>
        set({
          profiles: [],
          trip: null,
          votes: {},
          activeParticipant: null,
          joinedAs: null,
          previousTrip: null,
          lastMergedAt: {},
          mergeUndo: null,
          draftRamble: '',
          draftListening: null,
        }),
    }),
    {
      name: 'meridian.designer.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        trip: state.trip,
        votes: state.votes,
        activeParticipant: state.activeParticipant,
        joinedAs: state.joinedAs,
        previousTrip: state.previousTrip,
        lastMergedAt: state.lastMergedAt,
        draftRamble: state.draftRamble,
        draftListening: state.draftListening,
      }),
    },
  ),
);
