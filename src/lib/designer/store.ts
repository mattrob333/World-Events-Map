'use client';

import { mergeSignals, type Signal, type VibeDials } from '@/lib/vibe/signals';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Itinerary } from './itinerary';
import type { ListeningProfile } from './listening';
import { dedupeFamily, type ParseEngine, type TravelerProfile } from './profile';
import { isSafeId, mergeReply as mergeReplyInto, type MergeSummary, type TripReply } from './tripShare';
import { moveCard as moveCardBetween, type TripVotes } from './votes';
import type { TravelCard } from '@/lib/people/card';
import { addGuests as addGuestsTo, createGroup as newGroup, ensureDefaultGroups, MAX_GROUP_MEMBERS, MAX_GROUPS, type GroupKind, type TravelGroup } from '@/lib/travelers/groups';

export type SavedProfile = {
  id: string;
  profile: TravelerProfile;
  engine: ParseEngine;
  updatedAt: string;
  /** What the traveler calls this profile ("Family", "Solo"); derived when unset. */
  label?: string;
};

type SyncedTrip = SavedTrip & { lastMergedAt?: Record<string, string>; updatedAt: string };
export type SyncedState = { groups: TravelGroup[]; meId: string | null; youUpdatedAt: string; current: SyncedTrip | null; previous: SyncedTrip | null };

/** The trip a shared invite replaced on this device, kept so it can be restored. */
export type SavedTrip = { trip: Itinerary; votes: TripVotes; activeParticipant: string | null; joinedAs: string | null };

interface DesignerState {
  /** One traveler per profile: you, your partner, each kid, a friend. */
  profiles: SavedProfile[];
  /** Which profile is you (the passport). The first one saved, unless changed. */
  meId: string | null;
  setMe: (id: string) => void;
  /** Who is coming: Solo, Family, Friends, and any group added from a link. */
  groups: TravelGroup[];
  /** The group trips are planned for ("Traveling as"). */
  activeGroupId: string | null;
  setActiveGroup: (id: string) => void;
  addGroup: (name: string, kind?: GroupKind, memberIds?: string[]) => string;
  renameGroup: (id: string, name: string) => void;
  removeGroup: (id: string) => void;
  /** Adds or removes a traveler; the leader (first member) of Solo, Family and Friends stays. */
  toggleGroupMember: (groupId: string, profileId: string) => void;
  /** Another family's cards, from an "add group" link. */
  addGuests: (groupId: string, cards: TravelCard[]) => void;
  removeGuest: (groupId: string, guestId: string) => void;
  /** When the open trip (with votes), the set-aside trip, and "you" last changed on this device; for account saving. */
  tripUpdatedAt: string | null;
  previousTripUpdatedAt: string | null;
  youUpdatedAt: string | null;
  /** Groups, trips and "you" after merging with the account copy. */
  applySyncedState: (next: SyncedState) => void;
  /** Signing in with account saving, on a device another account used: its travelers, groups and trips leave this device first. */
  resetForAccount: (owner: string) => void;
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
let applyingRemote = false;

export const useDesignerStore = create<DesignerState>()(
  persist(
    (set, get) => ({
      profiles: [],
      meId: null,
      groups: [],
      activeGroupId: null,
      tripUpdatedAt: null,
      previousTripUpdatedAt: null,
      youUpdatedAt: null,
      applySyncedState: (next) => {
        applyingRemote = true;
        try {
          set((state) => {
            const ids = state.profiles.map((entry) => entry.id);
            const meId = next.meId && ids.includes(next.meId) ? next.meId : state.meId && ids.includes(state.meId) ? state.meId : (state.profiles[state.profiles.length - 1]?.id ?? null);
            // A trip open here that the account's copy doesn't list is set aside, not lost, when there's room.
            const orphan: SyncedTrip | null = state.trip && next.current?.trip.id !== state.trip.id && next.previous?.trip.id !== state.trip.id
              ? { trip: state.trip, votes: state.votes, activeParticipant: state.activeParticipant, joinedAs: state.joinedAs, updatedAt: state.tripUpdatedAt ?? new Date().toISOString() }
              : null;
            const previous = next.previous ?? (orphan && next.current ? orphan : null);
            const current = next.current ?? (orphan && !next.current ? orphan : null);
            const sameTrip = current?.trip.id === state.trip?.id;
            return {
              groups: ensureDefaultGroups(next.groups, meId, ids),
              meId,
              youUpdatedAt: orphan ? new Date().toISOString() : next.youUpdatedAt,
              trip: current?.trip ?? null,
              votes: current?.votes ?? {},
              activeParticipant: current?.activeParticipant ?? null,
              joinedAs: current?.joinedAs ?? null,
              lastMergedAt: (current as SyncedTrip | null)?.lastMergedAt ?? (sameTrip ? state.lastMergedAt : {}),
              mergeUndo: sameTrip ? state.mergeUndo : null,
              tripUpdatedAt: current?.updatedAt ?? null,
              previousTrip: previous ? { trip: previous.trip, votes: previous.votes, activeParticipant: previous.activeParticipant, joinedAs: previous.joinedAs } : null,
              previousTripUpdatedAt: previous?.updatedAt ?? null,
            };
          });
        } finally {
          applyingRemote = false;
        }
      },
      resetForAccount: (owner) =>
        set({
          accountSync: true,
          syncOwner: owner,
          syncStatus: 'idle',
          profiles: [],
          meId: null,
          groups: [],
          activeGroupId: null,
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
          tripUpdatedAt: null,
          previousTripUpdatedAt: null,
          youUpdatedAt: null,
        }),
      setMe: (id) =>
        set((state) => {
          if (!state.profiles.some((entry) => entry.id === id)) return {};
          const ids = state.profiles.map((entry) => entry.id);
          // The new you leads Solo, Family and Friends.
          const at = new Date().toISOString();
          const groups = state.groups.map((group) => (group.kind === 'custom' ? group : { ...group, memberIds: [id, ...group.memberIds.filter((m) => m !== id && m !== state.meId)], updatedAt: at }));
          return { meId: id, groups: ensureDefaultGroups(groups, id, ids) };
        }),
      setActiveGroup: (id) =>
        set((state) => {
          const group = state.groups.find((entry) => entry.id === id);
          if (!group) return {};
          // The leader's taste is what the rest of the app plans from.
          const lead = group.memberIds.find((member) => state.profiles.some((entry) => entry.id === member));
          return { activeGroupId: id, ...(lead ? { activeProfileId: lead } : {}) };
        }),
      addGroup: (name, kind = 'custom', memberIds = []) => {
        const group = newGroup(name, kind, memberIds.filter((id) => get().profiles.some((entry) => entry.id === id)));
        set((state) => ({ groups: [...state.groups, group].slice(0, MAX_GROUPS) }));
        return group.id;
      },
      renameGroup: (id, name) =>
        set((state) => ({
          groups: state.groups.map((group) => (group.id === id ? { ...group, name: name.replace(/\s+/g, ' ').trim().slice(0, 30) || group.name, updatedAt: new Date().toISOString() } : group)),
        })),
      removeGroup: (id) =>
        set((state) => {
          const group = state.groups.find((entry) => entry.id === id);
          if (!group || group.kind !== 'custom') return {};
          return { groups: state.groups.filter((entry) => entry.id !== id), activeGroupId: state.activeGroupId === id ? null : state.activeGroupId };
        }),
      toggleGroupMember: (groupId, profileId) =>
        set((state) => ({
          groups: state.groups.map((group) => {
            if (group.id !== groupId || group.kind === 'solo') return group;
            if (group.memberIds.includes(profileId)) {
              if (group.kind !== 'custom' && profileId === group.memberIds[0]) return group;
              return { ...group, memberIds: group.memberIds.filter((id) => id !== profileId), updatedAt: new Date().toISOString() };
            }
            if (!state.profiles.some((entry) => entry.id === profileId)) return group;
            return { ...group, memberIds: [...group.memberIds, profileId].slice(0, MAX_GROUP_MEMBERS), updatedAt: new Date().toISOString() };
          }),
        })),
      addGuests: (groupId, cards) =>
        set((state) => ({ groups: state.groups.map((group) => (group.id === groupId && group.kind !== 'solo' ? addGuestsTo(group, cards) : group)) })),
      removeGuest: (groupId, guestId) =>
        set((state) => ({
          groups: state.groups.map((group) => (group.id === groupId ? { ...group, guests: group.guests.filter((guest) => guest.id !== guestId), updatedAt: new Date().toISOString() } : group)),
        })),
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
        set((state) => {
          const kept = profiles.slice(0, 12);
          const ids = kept.map((entry) => entry.id);
          const meId = state.meId && ids.includes(state.meId) ? state.meId : (kept[kept.length - 1]?.id ?? null);
          return {
            profiles: kept,
            activeProfileId: state.activeProfileId && ids.includes(state.activeProfileId) ? state.activeProfileId : null,
            meId,
            groups: ensureDefaultGroups(state.groups, meId, ids),
          };
        }),
      setDraftRamble: (draftRamble) => set({ draftRamble }),
      setDraftListening: (draftListening) => set({ draftListening }),
      saveProfile: (profile) =>
        set((state) => {
          const previous = state.profiles.find((entry) => entry.id === profile.id);
          const saved = previous?.label && !profile.label ? { ...profile, label: previous.label } : profile;
          const profiles = [saved, ...state.profiles.filter((entry) => entry.id !== profile.id)].slice(0, 12);
          const ids = profiles.map((entry) => entry.id);
          // The first profile on a device is you.
          const meId = state.meId && ids.includes(state.meId) ? state.meId : profile.id;
          return { profiles, activeProfileId: previous ? state.activeProfileId ?? profile.id : state.meId ? state.activeProfileId ?? meId : profile.id, meId, groups: ensureDefaultGroups(state.groups, meId, ids) };
        }),
      removeProfile: (id) =>
        set((state) => {
          const profiles = state.profiles.filter((entry) => entry.id !== id);
          const ids = profiles.map((entry) => entry.id);
          const meId = state.meId === id ? (profiles[profiles.length - 1]?.id ?? null) : state.meId;
          return {
            profiles,
            activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
            meId,
            groups: ensureDefaultGroups(state.groups.map((group) => ({ ...group, memberIds: group.memberIds.filter((member) => member !== id) })), meId, ids),
          };
        }),
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
          meId: null,
          groups: [],
          activeGroupId: null,
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
          tripUpdatedAt: null,
          previousTripUpdatedAt: null,
          youUpdatedAt: null,
        }),
    }),
    {
      name: 'meridian.designer.v1',
      storage: createJSONStorage(() => localStorage),
      // v1: profiles saved before the family fix can hold the same kids twice; clean them once on load.
      // v2: travelers and groups. The oldest profile is you; Solo, Family and Friends start with you.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as { profiles?: unknown; meId?: string | null; groups?: TravelGroup[]; activeGroupId?: string | null } | null;
        if (version < 1 && state && Array.isArray(state.profiles)) {
          state.profiles = state.profiles.map((entry) => {
            const saved = entry as Partial<SavedProfile> | null;
            const family = saved?.profile?.family;
            return saved?.profile && Array.isArray(family) ? { ...saved, profile: { ...saved.profile, family: dedupeFamily(family) } } : entry;
          });
        }
        if (version < 2 && state) {
          const profiles = Array.isArray(state.profiles) ? (state.profiles as SavedProfile[]).filter((entry) => entry && typeof entry.id === 'string') : [];
          const meId = profiles[profiles.length - 1]?.id ?? null;
          state.meId = meId;
          state.groups = ensureDefaultGroups([], meId, profiles.map((entry) => entry.id));
          state.activeGroupId = null;
        }
        return persisted as DesignerState;
      },
      partialize: (state) => ({
        profiles: state.profiles,
        meId: state.meId,
        groups: state.groups,
        activeGroupId: state.activeGroupId,
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
        tripUpdatedAt: state.tripUpdatedAt,
        previousTripUpdatedAt: state.previousTripUpdatedAt,
        youUpdatedAt: state.youUpdatedAt,
      }),
    },
  ),
);

// Stamps what changed on this device, so account saving knows which copy is newer.
// Not while loading from storage (hasHydrated is false then) or applying the account's copy.
useDesignerStore.subscribe((state, prev) => {
  if (applyingRemote || !useDesignerStore.persist?.hasHydrated?.()) return;
  const now = new Date().toISOString();
  const patch: Partial<Pick<DesignerState, 'tripUpdatedAt' | 'previousTripUpdatedAt' | 'youUpdatedAt'>> = {};
  if (state.trip !== prev.trip || state.votes !== prev.votes || state.activeParticipant !== prev.activeParticipant || state.joinedAs !== prev.joinedAs || state.lastMergedAt !== prev.lastMergedAt) {
    patch.tripUpdatedAt = state.trip ? now : null;
  }
  if (state.previousTrip !== prev.previousTrip) patch.previousTripUpdatedAt = state.previousTrip ? now : null;
  if (state.meId !== prev.meId || state.trip?.id !== prev.trip?.id || state.previousTrip?.trip.id !== prev.previousTrip?.trip.id) patch.youUpdatedAt = now;
  if (Object.keys(patch).length) useDesignerStore.setState(patch);
});

/** The profile in use: the chosen one, else the newest. */
export function pickActiveProfile(profiles: SavedProfile[], activeId: string | null): SavedProfile | undefined {
  return profiles.find((entry) => entry.id === activeId) ?? profiles[0];
}

export function useActiveProfile(): SavedProfile | undefined {
  const profiles = useDesignerStore((state) => state.profiles);
  const activeId = useDesignerStore((state) => state.activeProfileId);
  return pickActiveProfile(profiles, activeId);
}

/**
 * What to call a profile: a chosen label, else the traveler's name. An
 * unnamed profile falls back to who it describes: "Family" when kids come
 * along, "Crew" with other adults, else "Solo".
 */
export function profileLabel(saved: SavedProfile): string {
  if (saved.label) return saved.label;
  if (saved.profile.name) return saved.profile.name;
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

/** The group trips are planned for: the chosen one, else Family when it has more than you, else Solo. */
export function pickActiveGroup(groups: TravelGroup[], activeId: string | null): TravelGroup | undefined {
  return groups.find((group) => group.id === activeId)
    ?? groups.find((group) => group.kind === 'family' && group.memberIds.length > 1)
    ?? groups.find((group) => group.kind === 'solo')
    ?? groups[0];
}

export function useActiveGroup(): TravelGroup | undefined {
  const groups = useDesignerStore((state) => state.groups);
  const activeId = useDesignerStore((state) => state.activeGroupId);
  return pickActiveGroup(groups, activeId);
}
