import type { Itinerary } from '@/lib/designer/itinerary';
import type { SavedTrip } from '@/lib/designer/store';
import { cleanVotes, isSafeId, sanitizeTrip } from '@/lib/designer/tripShare';
import type { TripVotes } from '@/lib/designer/votes';
import { decodeCard, encodeCard, type TravelCard } from '@/lib/people/card';
import { MAX_GROUP_MEMBERS, MAX_GROUPS, MAX_GUESTS, type GroupGuest, type GroupKind, type TravelGroup } from './groups';

/**
 * Account saving for groups, trips (with votes) and "which profile is you",
 * in `traveler_state` (migration 010). The same rules as traveler profiles:
 * opt-in, only for the account the device belongs to, the newer copy of each
 * item wins, and a deletion newer than this device's copy removes it.
 */
export type StateKind = 'group' | 'trip' | 'you';

export type RemoteState = { kind: StateKind; local_id: string; data: unknown; deleted: boolean; updated_at: string };

/** One syncable thing on this device, with when it last changed. */
export type LocalItem = { kind: StateKind; id: string; data: unknown; updatedAt: string };

export type YouRow = { meId: string | null; tripId: string | null; previousTripId: string | null };

export type TripRow = SavedTrip & { lastMergedAt?: Record<string, string> };

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const KINDS: readonly StateKind[] = ['group', 'trip', 'you'];
const GROUP_KINDS: readonly GroupKind[] = ['solo', 'family', 'friends', 'custom'];
export const EPOCH = new Date(0).toISOString();

const time = (iso: string | undefined) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
};
const key = (kind: StateKind, id: string) => `${kind}:${id}`;
const obj = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null);
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const iso = (value: unknown) => (typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : EPOCH);
const safeId = (value: unknown): string | null => (typeof value === 'string' && SAFE_ID.test(value) ? value : null);

// --- reading the account's copy (it's the member's own, but still checked) ---

export function readGroup(value: unknown, id: string): TravelGroup | null {
  const raw = obj(value);
  if (!raw || !SAFE_ID.test(id)) return null;
  const kind = GROUP_KINDS.includes(raw.kind as GroupKind) ? (raw.kind as GroupKind) : 'custom';
  const memberIds = [...new Set((Array.isArray(raw.memberIds) ? raw.memberIds : []).map(safeId).filter((m): m is string => Boolean(m)))].slice(0, MAX_GROUP_MEMBERS);
  const guests: GroupGuest[] = (Array.isArray(raw.guests) ? raw.guests : [])
    .slice(0, MAX_GUESTS)
    .map((item): GroupGuest | null => {
      const guest = obj(item);
      const guestId = safeId(guest?.id);
      // Through the card link's own encoder and decoder, so a guest is never more than a card link could carry.
      let card: TravelCard | null = null;
      try {
        card = guest?.card && typeof guest.card === 'object' ? decodeCard(encodeCard(guest.card as TravelCard)) : null;
      } catch {
        card = null;
      }
      return guestId && card ? { id: guestId, card, addedAt: iso(guest?.addedAt) } : null;
    })
    .filter((guest): guest is GroupGuest => Boolean(guest));
  return { id, name: text(raw.name, 30) || 'Group', kind, memberIds, guests, updatedAt: iso(raw.updatedAt) };
}

export function readTrip(value: unknown): TripRow | null {
  const raw = obj(value);
  if (!raw) return null;
  let trip: Itinerary;
  try {
    trip = sanitizeTrip(raw.trip);
  } catch {
    return null;
  }
  const source = obj(raw.trip)!;
  const joinedFrom = text(source.joinedFrom, 30);
  // Music taste stays with the member's own trip; it's only ever shown back to them.
  const taste = obj(source.taste) && JSON.stringify(source.taste).length <= 20000 ? (source.taste as Itinerary['taste']) : undefined;
  const participants = new Set(trip.participants.map((p) => p.id));
  const who = (value: unknown) => (typeof value === 'string' && participants.has(value) ? value : null);
  const merged = obj(raw.lastMergedAt) ?? {};
  const lastMergedAt = Object.fromEntries(Object.entries(merged).filter(([id, at]) => isSafeId(id) && typeof at === 'string' && Number.isFinite(Date.parse(at))).slice(0, 40)) as Record<string, string>;
  return {
    trip: { ...trip, ...(taste ? { taste } : {}), ...(joinedFrom ? { joinedFrom } : {}) },
    votes: cleanVotes(raw.votes) as TripVotes,
    activeParticipant: who(raw.activeParticipant),
    joinedAs: who(raw.joinedAs),
    lastMergedAt,
  };
}

export function readYou(value: unknown): YouRow {
  const raw = obj(value) ?? {};
  return { meId: safeId(raw.meId), tripId: safeId(raw.tripId), previousTripId: safeId(raw.previousTripId) };
}

// --- this device's items -----------------------------------------------------

export type SyncSlice = {
  groups: TravelGroup[];
  meId: string | null;
  trip: Itinerary | null;
  votes: TripVotes;
  activeParticipant: string | null;
  joinedAs: string | null;
  lastMergedAt: Record<string, string>;
  previousTrip: SavedTrip | null;
  /** When the open trip, its votes or who you are on it last changed here. */
  tripUpdatedAt: string | null;
  previousTripUpdatedAt: string | null;
  /** When "you" (meId, the open trips) last changed here. */
  youUpdatedAt: string | null;
};

export function localItems(state: SyncSlice): LocalItem[] {
  const items: LocalItem[] = state.groups.filter((group) => SAFE_ID.test(group.id)).map((group) => ({ kind: 'group', id: group.id, data: group, updatedAt: group.updatedAt }));
  if (state.trip && SAFE_ID.test(state.trip.id)) {
    const row: TripRow = { trip: state.trip, votes: state.votes, activeParticipant: state.activeParticipant, joinedAs: state.joinedAs, lastMergedAt: state.lastMergedAt };
    items.push({ kind: 'trip', id: state.trip.id, data: row, updatedAt: state.tripUpdatedAt ?? EPOCH });
  }
  if (state.previousTrip && SAFE_ID.test(state.previousTrip.trip.id) && state.previousTrip.trip.id !== state.trip?.id) {
    items.push({ kind: 'trip', id: state.previousTrip.trip.id, data: state.previousTrip, updatedAt: state.previousTripUpdatedAt ?? EPOCH });
  }
  const you: YouRow = { meId: state.meId, tripId: state.trip?.id ?? null, previousTripId: state.previousTrip?.trip.id ?? null };
  items.push({ kind: 'you', id: 'you', data: you, updatedAt: state.youUpdatedAt ?? EPOCH });
  return items;
}

// --- merging -----------------------------------------------------------------

/**
 * This device's items and the account's, newest copy of each winning. A
 * deletion newer than the device's copy removes it. Returns the merged
 * items and what should go up.
 */
export function mergeItems(local: readonly LocalItem[], remote: readonly RemoteState[]): { items: LocalItem[]; push: LocalItem[] } {
  const byKey = new Map(local.map((item) => [key(item.kind, item.id), item]));
  const seen = new Set<string>();
  const push: LocalItem[] = [];
  for (const row of remote) {
    if (!KINDS.includes(row.kind) || !SAFE_ID.test(row.local_id)) continue;
    const k = key(row.kind, row.local_id);
    seen.add(k);
    const mine = byKey.get(k);
    const remoteNewer = time(row.updated_at) > time(mine?.updatedAt);
    if (row.deleted) {
      if (mine && !remoteNewer) push.push(mine);
      else byKey.delete(k);
    } else if (!mine || remoteNewer) {
      byKey.set(k, { kind: row.kind, id: row.local_id, data: row.data, updatedAt: row.updated_at });
    } else if (time(mine.updatedAt) > time(row.updated_at)) {
      push.push(mine);
    }
  }
  for (const item of local) if (!seen.has(key(item.kind, item.id))) push.push(item);
  return { items: [...byKey.values()], push };
}

/**
 * The device state the merged items describe. The "you" row says which trips
 * are open; groups are read and checked. Anything that fails its check is
 * left out rather than guessed at.
 */
export function stateFromItems(items: readonly LocalItem[]): {
  groups: TravelGroup[];
  meId: string | null;
  youUpdatedAt: string;
  current: (TripRow & { updatedAt: string }) | null;
  previous: (TripRow & { updatedAt: string }) | null;
} {
  const groups = items
    .filter((item) => item.kind === 'group')
    .map((item) => {
      const group = readGroup(item.data, item.id);
      return group ? { ...group, updatedAt: item.updatedAt } : null;
    })
    .filter((group): group is TravelGroup => Boolean(group))
    .slice(0, MAX_GROUPS);
  const youItem = items.find((item) => item.kind === 'you');
  const you = readYou(youItem?.data);
  const tripById = (id: string | null) => {
    const item = id ? items.find((entry) => entry.kind === 'trip' && entry.id === id) : undefined;
    const row = item ? readTrip(item.data) : null;
    return row && item ? { ...row, updatedAt: item.updatedAt } : null;
  };
  const current = tripById(you.tripId);
  const previous = you.previousTripId !== you.tripId ? tripById(you.previousTripId) : null;
  return { groups, meId: you.meId, youUpdatedAt: youItem?.updatedAt ?? EPOCH, current, previous };
}

/** What the account is known to hold after a merge: everything merged that didn't need pushing. */
export function knownItems(items: readonly LocalItem[], push: readonly LocalItem[]): Map<string, string> {
  const pushed = new Set(push.map((item) => key(item.kind, item.id)));
  return new Map(items.filter((item) => !pushed.has(key(item.kind, item.id))).map((item) => [key(item.kind, item.id), item.updatedAt]));
}

/** What to send: items changed since the account last had them, and ones removed here. */
export function pendingItems(items: readonly LocalItem[], known: ReadonlyMap<string, string>): { changed: LocalItem[]; removed: { kind: StateKind; id: string }[] } {
  const here = new Set(items.map((item) => key(item.kind, item.id)));
  return {
    changed: items.filter((item) => known.get(key(item.kind, item.id)) !== item.updatedAt),
    removed: [...known.keys()]
      .filter((k) => !here.has(k))
      .map((k) => {
        const at = k.indexOf(':');
        return { kind: k.slice(0, at) as StateKind, id: k.slice(at + 1) };
      }),
  };
}

export const stateKey = key;

export function toRemoteState(item: LocalItem): RemoteState {
  return { kind: item.kind, local_id: item.id, data: item.data, deleted: false, updated_at: item.updatedAt };
}

export function stateTombstone(kind: StateKind, id: string, at = new Date()): RemoteState {
  return { kind, local_id: id, data: {}, deleted: true, updated_at: at.toISOString() };
}
