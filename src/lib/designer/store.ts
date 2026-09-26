'use client';

import { mergeSignals, type Signal, type VibeDials } from '@/lib/vibe/signals';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Itinerary } from './itinerary';
import type { ListeningProfile } from './listening';
import { dedupeFamily, type ParseEngine, type TravelerProfile } from './profile';
import { isSafeId, mergeReply as mergeReplyInto, type MergeSummary, type TripReply } from './tripShare';
import { moveCard as moveCardBetween, type TripVotes } from './votes';

export type SavedProfile = {
  id: string;
  profile: TravelerProfile;
  engine: ParseEngine;
  updatedAt: string;
  /** What the traveler calls this profile ("Family", "Solo"); derived when unset. */
  label?: string;
};

/** The trip a shared invite replaced on this device, kept so it can be restored. */
export type SavedTrip = { trip: Itinerary; votes: TripVotes; activeParticipant: string | null; joinedAs: string | null };

interface DesignerState {
  profiles: SavedProfile[];
  /** The travel profile in use ("Traveling as"); null means the newest one. */
  activeProfileId: string | null;
  setActiveProfile: (id: string) => void;
  renameProfile: (id: string, label: string) => void;
  /** Adds Vibe signals to a saved profile (newer word wins per signal), and sets its dials. */
  updateSignals: (id: string, signals: Signal[], dials?: VibeDials) => void;
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
  /** Keep traveler profiles in the account too. Opt-in (Settings), per device. */
  accountSync: boolean;
  /** The account this device's profiles belong to once synced; another account never receives them. */
  syncOwner: string | null;
  setAccountSync: (on: boolean, owner?: string | null) => void;
  /** In memory only: how the last account save went, for Settings to show. */
  syncStatus: 'idle' | 'syncing' | 'saved' | 'error';
  setSyncStatus: (status: 'idle' | 'syncing' | 'saved' | 'error') => void;
  /** The profiles after merging with the account copy; the chosen one stays chosen when it still exists. */
  applySyncedProfiles: (profiles: SavedProfile[]) => void;
  setTrip: (trip: Itinerary) => void;
  /**
   * Opens a shared trip on this device, keeping everyone's votes so far. A
   * different trip already here moves to `previousTrip` instead of being lost.
   */
  importTrip: (trip: Itinerary, votes: TripVotes, me: string) => void;
  /** Swaps the previous trip back in (the current one takes its slot). */
  restorePreviousTrip: () => void;
  /** Starts a trip built elsewhere (the Vibe canvas); a different trip in progress is set aside, not lost. */
  startTrip: (trip: Itinerary) => void;
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
      activeProfileId: null,
      trip: null,
      votes: {},
      activeParticipant: null,
      joinedAs: null,
      previousTrip: null,
      lastMergedAt: {},
      mergeUndo: null,
      draftRamble: '',
      draftListening: null,
      accountSync: false,
      syncOwner: null,
      setAccountSync: (accountSync, owner) => set(accountSync ? { accountSync, syncOwner: owner ?? null } : { accountSync, syncStatus: 'idle' }),
      syncStatus: 'idle',
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      applySyncedProfiles: (profiles) =>
        set((state) => ({
          profiles: profiles.slice(0, 12),
          activeProfileId: state.activeProfileId && profiles.some((entry) => entry.id === state.activeProfileId) ? state.activeProfileId : null,
        })),
      setDraftRamble: (draftRamble) => set({ draftRamble }),
      setDraftListening: (draftListening) => set({ draftListening }),
      saveProfile: (profile) =>
        set((state) => {
          const previous = state.profiles.find((entry) => entry.id === profile.id);
          const saved = previous?.label && !profile.label ? { ...profile, label: previous.label } : profile;
          return { profiles: [saved, ...state.profiles.filter((entry) => entry.id !== profile.id)].slice(0, 12), activeProfileId: profile.id };
        }),
      removeProfile: (id) =>
        set((state) => ({
          profiles: state.profiles.filter((entry) => entry.id !== id),
          activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
        })),
      setActiveProfile: (id) => set((state) => (state.profiles.some((entry) => entry.id === id) ? { activeProfileId: id } : {})),
      renameProfile: (id, label) =>
        set((state) => ({
          profiles: state.profiles.map((entry) => (entry.id === id ? { ...entry, label: label.replace(/\s+/g, ' ').trim().slice(0, 24) || undefined, updatedAt: new Date().toISOString() } : entry)),
        })),
      updateSignals: (id, signals, dials) =>
        set((state) => ({
          profiles: state.profiles.map((entry) => (entry.id === id
            ? { ...entry, updatedAt: new Date().toISOString(), profile: { ...entry.profile, signals: mergeSignals(entry.profile.signals ?? [], signals), ...(dials ? { dials } : {}) } }
            : entry)),
        })),
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
      startTrip: (trip) =>
        set((state) => ({
          ...(state.trip && state.trip.id !== trip.id
            ? { previousTrip: { trip: state.trip, votes: state.votes, activeParticipant: state.activeParticipant, joinedAs: state.joinedAs } }
            : {}),
          trip,
          votes: {},
          activeParticipant: trip.participants[0]?.id ?? null,
          joinedAs: null,
          lastMergedAt: {},
          mergeUndo: null,
        })),
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
        // After "Same person: combine", the sender's next link still carries their own id (review S6).
        const sender = reply.participant.id;
        if (sender !== who && isSafeId(sender)) {
          const knownSender = Object.hasOwn(lastMergedAt, sender) ? lastMergedAt[sender] : undefined;
          if (!knownSender || Date.parse(at) > Date.parse(knownSender)) nextMerged[sender] = at;
        }
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
      // Device only: account saving goes off in the same update, so the cleared
      // profiles are never read as deletions and removed from the account.
      clearAll: () =>
        set({
          accountSync: false,
          syncOwner: null,
          syncStatus: 'idle',
          profiles: [],
          activeProfileId: null,
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
      // v1: profiles saved before the family fix can hold the same kids twice; clean them once on load.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as { profiles?: unknown } | null;
        if (version < 1 && state && Array.isArray(state.profiles)) {
          state.profiles = state.profiles.map((entry) => {
            const saved = entry as Partial<SavedProfile> | null;
            const family = saved?.profile?.family;
            return saved?.profile && Array.isArray(family) ? { ...saved, profile: { ...saved.profile, family: dedupeFamily(family) } } : entry;
          });
        }
        return persisted as DesignerState;
      },
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        trip: state.trip,
        votes: state.votes,
        activeParticipant: state.activeParticipant,
        joinedAs: state.joinedAs,
        previousTrip: state.previousTrip,
        lastMergedAt: state.lastMergedAt,
        draftRamble: state.draftRamble,
        draftListening: state.draftListening,
        accountSync: state.accountSync,
        syncOwner: state.syncOwner,
      }),
    },
  ),
);

/** The profile in use: the chosen one, else the newest. */
export function pickActiveProfile(profiles: SavedProfile[], activeId: string | null): SavedProfile | undefined {
  return profiles.find((entry) => entry.id === activeId) ?? profiles[0];
}

export function useActiveProfile(): SavedProfile | undefined {
  const profiles = useDesignerStore((state) => state.profiles);
  const activeId = useDesignerStore((state) => state.activeProfileId);
  return pickActiveProfile(profiles, activeId);
}

/** "Family" when kids come along, "Crew" with other adults, else "Solo"; a chosen label wins. */
export function profileLabel(saved: SavedProfile): string {
  if (saved.label) return saved.label;
  const family = saved.profile.family ?? [];
  if (family.some((member) => member.relation === 'child' || (member.age !== undefined && member.age < 18))) return 'Family';
  if (family.length) return family.some((member) => member.relation === 'partner') && family.length === 1 ? 'Couple' : 'Crew';
  return 'Solo';
}

export type LocalCopy = SavedTrip & { setAside: boolean };

/**
 * This device's copy of a linked trip: the open one, or the one set aside
 * when another invite was opened. Without the second case, reopening your
 * own set-aside trip's link would overwrite it (review S1).
 */
export function localCopyOf(tripId: string, state: Pick<DesignerState, 'trip' | 'votes' | 'activeParticipant' | 'joinedAs' | 'previousTrip'>): LocalCopy | null {
  if (state.trip?.id === tripId) return { trip: state.trip, votes: state.votes, activeParticipant: state.activeParticipant, joinedAs: state.joinedAs, setAside: false };
  if (state.previousTrip?.trip.id === tripId) return { ...state.previousTrip, setAside: true };
  return null;
}
