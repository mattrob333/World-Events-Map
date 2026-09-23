'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Itinerary } from './itinerary';
import type { ListeningProfile } from './listening';
import type { ParseEngine, TravelerProfile } from './profile';
import { moveCard as moveCardBetween, type TripVotes } from './votes';

export type SavedProfile = {
  id: string;
  profile: TravelerProfile;
  engine: ParseEngine;
  updatedAt: string;
};

interface DesignerState {
  profiles: SavedProfile[];
  trip: Itinerary | null;
  votes: TripVotes;
  activeParticipant: string | null;
  /** Board in progress: survives the Spotify sign-in redirect. */
  draftRamble: string;
  draftListening: ListeningProfile | null;
  setDraftRamble: (text: string) => void;
  setDraftListening: (listening: ListeningProfile | null) => void;
  saveProfile: (profile: SavedProfile) => void;
  removeProfile: (id: string) => void;
  setTrip: (trip: Itinerary) => void;
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
      draftRamble: '',
      draftListening: null,
      setDraftRamble: (draftRamble) => set({ draftRamble }),
      setDraftListening: (draftListening) => set({ draftListening }),
      saveProfile: (profile) =>
        set((state) => ({ profiles: [profile, ...state.profiles.filter((entry) => entry.id !== profile.id)].slice(0, 12) })),
      removeProfile: (id) => set((state) => ({ profiles: state.profiles.filter((entry) => entry.id !== id) })),
      setTrip: (trip) => set({ trip, votes: {}, activeParticipant: trip.participants[0]?.id ?? null }),
      clearTrip: () => set({ trip: null, votes: {}, activeParticipant: null }),
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
      clearAll: () => set({ profiles: [], trip: null, votes: {}, activeParticipant: null, draftRamble: '', draftListening: null }),
    }),
    {
      name: 'meridian.designer.v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        trip: state.trip,
        votes: state.votes,
        activeParticipant: state.activeParticipant,
        draftRamble: state.draftRamble,
        draftListening: state.draftListening,
      }),
    },
  ),
);
