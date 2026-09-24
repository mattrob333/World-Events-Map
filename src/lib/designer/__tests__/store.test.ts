import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDeviceData, pruneResearchCache, RESEARCH_PREFIX, researchKeys, writeResearchCache } from '../deviceData';
import { composeLocally, participantStyle, type Itinerary, type Participant } from '../itinerary';
import type { useDesignerStore as Store } from '../store';
import { replyFor } from '../tripShare';

class MemoryStorage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
let useDesignerStore: typeof Store;

beforeAll(async () => {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  ({ useDesignerStore } = await import('../store'));
});

beforeEach(() => {
  useDesignerStore.getState().clearAll();
  storage.clear();
});

const matt: Participant = { id: 'p0', name: 'Matt', kind: 'adult', tags: [], ...participantStyle(0) };
const sam: Participant = { id: 'g-sam', name: 'Sam', kind: 'adult', tags: [], ...participantStyle(1) };

function trip(name: string, participants: Participant[] = [matt, sam]): Itinerary {
  return composeLocally({ destination: 'custom', place: { name, kind: 'city' }, startDate: '2027-05-10', nights: 2, participants }, new Date('2026-09-24T12:00:00Z'));
}

describe('designer store: joining and restoring (G07)', () => {
  it('keeps the trip an invite replaced and swaps it back', () => {
    const store = useDesignerStore.getState();
    const tokyo = trip('Tokyo');
    store.setTrip(tokyo);
    const slot = tokyo.days[1].slots[0];
    store.vote(slot.id, slot.cardIds[0], 'p0', 1);
    const lisbon = { ...trip('Lisbon'), id: 'trip-lisbon', joinedFrom: 'Matt' };
    useDesignerStore.getState().importTrip(lisbon, {}, 'g-sam');
    let state = useDesignerStore.getState();
    expect(state.trip?.id).toBe('trip-lisbon');
    expect(state.joinedAs).toBe('g-sam');
    expect(state.previousTrip?.trip.id).toBe(tokyo.id);
    expect(state.previousTrip?.votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1 });
    state.restorePreviousTrip();
    state = useDesignerStore.getState();
    expect(state.trip?.id).toBe(tokyo.id);
    expect(state.votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1 });
    expect(state.joinedAs).toBeNull();
    expect(state.previousTrip?.trip.id).toBe('trip-lisbon');
  });

  it('finds a set-aside copy of a linked trip, so reopening its link restores instead of overwriting (S1)', async () => {
    const { localCopyOf } = await import('../store');
    const paris = trip('Paris');
    useDesignerStore.getState().setTrip(paris);
    const slot = paris.days[1].slots[0];
    useDesignerStore.getState().vote(slot.id, slot.cardIds[0], 'p0', 1);
    useDesignerStore.getState().importTrip({ ...trip('Lisbon'), id: 'trip-lisbon', joinedFrom: 'Ana' }, {}, 'g-sam');
    const copy = localCopyOf(paris.id, useDesignerStore.getState());
    expect(copy?.setAside).toBe(true);
    expect(copy?.trip.joinedFrom).toBeUndefined();
    expect(copy?.votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1 });
    expect(localCopyOf('trip-lisbon', useDesignerStore.getState())?.setAside).toBe(false);
    expect(localCopyOf('nope', useDesignerStore.getState())).toBeNull();
  });

  it('re-importing the same trip does not touch the saved slot', () => {
    const lisbon = { ...trip('Lisbon'), id: 'trip-lisbon', joinedFrom: 'Matt' };
    useDesignerStore.getState().importTrip(lisbon, {}, 'g-sam');
    useDesignerStore.getState().importTrip(lisbon, {}, 'g-sam');
    expect(useDesignerStore.getState().previousTrip).toBeNull();
  });
});

describe('designer store: merging picks (G01, G06, G09)', () => {
  it('reports what landed, remembers the newest link per traveler, and undoes', () => {
    const lisbon = trip('Lisbon');
    useDesignerStore.getState().setTrip(lisbon);
    const slot = lisbon.days[1].slots[0];
    useDesignerStore.getState().vote(slot.id, slot.cardIds[0], 'p0', 1);
    const before = useDesignerStore.getState().votes;
    const reply = replyFor(lisbon, { [slot.id]: { [slot.cardIds[0]]: { 'g-sam': -1 }, 'custom:999': { 'g-sam': 1 } } }, 'g-sam', new Date('2026-09-24T10:05:00Z'));
    const summary = useDesignerStore.getState().mergeReply(reply);
    expect(summary).toMatchObject({ loves: 0, passes: 1, name: 'Sam' });
    let state = useDesignerStore.getState();
    expect(state.votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1, 'g-sam': -1 });
    expect(state.lastMergedAt['g-sam']).toBe('2026-09-24T10:05:00.000Z');
    // An older link doesn't move the marker back.
    state.mergeReply({ ...reply, at: '2026-09-24T10:01:00.000Z' });
    expect(useDesignerStore.getState().lastMergedAt['g-sam']).toBe('2026-09-24T10:05:00.000Z');
    expect(useDesignerStore.getState().undoMerge()).toBe(true);
    state = useDesignerStore.getState();
    expect(state.lastMergedAt['g-sam']).toBe('2026-09-24T10:05:00.000Z');
    useDesignerStore.getState().undoMerge(); // only one level
    expect(useDesignerStore.getState().votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1, 'g-sam': -1 });
    // Undo restores the exact pre-merge votes.
    useDesignerStore.getState().setTrip(lisbon);
    useDesignerStore.getState().vote(slot.id, slot.cardIds[0], 'p0', 1);
    useDesignerStore.getState().mergeReply(reply);
    useDesignerStore.getState().undoMerge();
    expect(useDesignerStore.getState().votes).toEqual(before);
    expect(useDesignerStore.getState().lastMergedAt).toEqual({});
  });

  it('remembers the sender id after "combine", so their older link is still spotted (S6)', () => {
    const lisbon = trip('Lisbon', [matt]);
    useDesignerStore.getState().setTrip(lisbon);
    const slot = lisbon.days[1].slots[0];
    const guest = { ...lisbon, participants: [matt, { ...sam, id: 'g-ana', name: 'Ana' }] };
    const reply = replyFor(guest, { [slot.id]: { [slot.cardIds[0]]: { 'g-ana': 1 } } }, 'g-ana', new Date('2026-09-24T10:05:00Z'));
    useDesignerStore.getState().mergeReply(reply, { as: 'p0' });
    expect(useDesignerStore.getState().lastMergedAt['g-ana']).toBe('2026-09-24T10:05:00.000Z');
  });

  it('renames the organizer placeholder', () => {
    useDesignerStore.getState().setTrip(trip('Lisbon', [{ ...matt, name: 'You' }, sam]));
    useDesignerStore.getState().renameParticipant('p0', '  Matt  ');
    expect(useDesignerStore.getState().trip?.participants[0].name).toBe('Matt');
  });
});

describe('clearing the device (K13)', () => {
  it('clearAll forgets everything the designer keeps, including the saved trip', () => {
    useDesignerStore.getState().setTrip(trip('Tokyo'));
    useDesignerStore.getState().importTrip({ ...trip('Lisbon'), id: 'trip-lisbon', joinedFrom: 'Matt' }, {}, 'g-sam');
    useDesignerStore.getState().setDraftRamble('we love loud bars');
    useDesignerStore.getState().clearAll();
    const state = useDesignerStore.getState();
    expect([state.trip, state.previousTrip, state.joinedAs, state.draftRamble, state.profiles.length]).toEqual([null, null, null, '', 0]);
    expect(storage.getItem('meridian.designer.v1')).not.toContain('Tokyo');
  });

  it('ranks v2 { savedAt } entries by age, so a fresh place is not evicted first (retest N3)', () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 8, 24, 0, minutes)).toISOString();
    for (let i = 0; i < 10; i += 1) storage.setItem(`${RESEARCH_PREFIX}v1-${i}`, JSON.stringify({ generatedAt: at(i) }));
    writeResearchCache(`${RESEARCH_PREFIX}v2:place:lisbon`, { savedAt: at(60), value: {} }, 10, storage);
    writeResearchCache(`${RESEARCH_PREFIX}v2:fares:lisbon`, { savedAt: at(61), value: {} }, 10, storage);
    expect(storage.getItem(`${RESEARCH_PREFIX}v2:place:lisbon`)).not.toBeNull();
    expect(storage.getItem(`${RESEARCH_PREFIX}v1-0`)).toBeNull();
  });

  it('prunes research to the newest entries and clears it all', () => {
    const at = (minutes: number) => new Date(Date.UTC(2026, 8, 24, 0, minutes)).toISOString();
    for (let i = 0; i < 14; i += 1) storage.setItem(`${RESEARCH_PREFIX}place-${i}`, JSON.stringify({ generatedAt: at(i) }));
    storage.setItem('unrelated', 'keep');
    expect(pruneResearchCache(10, undefined, storage)).toBe(4);
    expect(researchKeys(storage).sort()).toEqual(Array.from({ length: 10 }, (_, i) => `${RESEARCH_PREFIX}place-${i + 4}`).sort());
    // A write keeps the new entry even if its timestamp is old, and prunes to the cap.
    expect(writeResearchCache(`${RESEARCH_PREFIX}new`, { generatedAt: at(0) }, 10, storage)).toBe(true);
    expect(researchKeys(storage)).toHaveLength(10);
    expect(storage.getItem(`${RESEARCH_PREFIX}new`)).not.toBeNull();
    expect(writeResearchCache('not-research', {}, 10, storage)).toBe(false);
    storage.setItem('meridian.designer.v1', '{}');
    clearDeviceData(storage);
    expect(researchKeys(storage)).toEqual([]);
    expect(storage.getItem('meridian.designer.v1')).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });
});
