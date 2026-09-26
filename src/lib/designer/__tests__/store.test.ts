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

  it('clearAll turns account saving off in the same update, so the cleared profiles are never pushed as deletions', () => {
    const seen: boolean[] = [];
    useDesignerStore.getState().setAccountSync(true, 'user-a');
    const off = useDesignerStore.subscribe((state, previous) => {
      if (state.profiles !== previous.profiles) seen.push(state.accountSync);
    });
    useDesignerStore.getState().saveProfile({ id: 'mb-x', profile: { heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '' }, engine: 'on-device', updatedAt: new Date().toISOString() });
    useDesignerStore.getState().clearAll();
    off();
    // The save was seen with sync on; the clear only ever with sync already off.
    expect(seen).toEqual([true, false]);
    expect(useDesignerStore.getState().syncOwner).toBeNull();
  });

  it('account saving starts off', () => {
    useDesignerStore.getState().clearAll();
    expect(useDesignerStore.getState().accountSync).toBe(false);
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

describe('travelers and groups', () => {
  const profile = (name: string, age?: number) => ({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '', name, age });
  const save = (id: string, name: string, age?: number) =>
    useDesignerStore.getState().saveProfile({ id, profile: profile(name, age), engine: 'on-device', updatedAt: new Date().toISOString() });

  it('the first profile is you, and Solo, Family and Friends start with you', () => {
    save('p-matt', 'Matt');
    const state = useDesignerStore.getState();
    expect(state.meId).toBe('p-matt');
    expect(state.groups.map((group) => [group.kind, group.memberIds])).toEqual([['solo', ['p-matt']], ['family', ['p-matt']], ['friends', ['p-matt']]]);
  });

  it('adding a traveler keeps you as the one planning, and groups take them in only when asked', () => {
    save('p-matt', 'Matt');
    save('p-leo', 'Leo', 8);
    const state = useDesignerStore.getState();
    expect(state.meId).toBe('p-matt');
    expect(state.activeProfileId).toBe('p-matt');
    const family = state.groups.find((group) => group.kind === 'family')!;
    expect(family.memberIds).toEqual(['p-matt']);
    state.toggleGroupMember(family.id, 'p-leo');
    expect(useDesignerStore.getState().groups.find((group) => group.kind === 'family')!.memberIds).toEqual(['p-matt', 'p-leo']);
  });

  it('never takes you out of Solo, Family or Friends, and Solo stays just you', () => {
    save('p-matt', 'Matt');
    save('p-marina', 'Marina');
    const { groups, toggleGroupMember } = useDesignerStore.getState();
    const family = groups.find((group) => group.kind === 'family')!;
    const solo = groups.find((group) => group.kind === 'solo')!;
    toggleGroupMember(family.id, 'p-matt');
    toggleGroupMember(solo.id, 'p-marina');
    const after = useDesignerStore.getState().groups;
    expect(after.find((group) => group.kind === 'family')!.memberIds).toEqual(['p-matt']);
    expect(after.find((group) => group.kind === 'solo')!.memberIds).toEqual(['p-matt']);
  });

  it('switching the group plans from its leader', () => {
    save('p-matt', 'Matt');
    save('p-marina', 'Marina');
    const state = useDesignerStore.getState();
    const id = state.addGroup('Marina and the girls', 'custom', ['p-marina']);
    useDesignerStore.getState().setActiveGroup(id);
    expect(useDesignerStore.getState().activeGroupId).toBe(id);
    expect(useDesignerStore.getState().activeProfileId).toBe('p-marina');
  });

  it('deleting a traveler takes them out of every group; deleting you hands the passport on', () => {
    save('p-matt', 'Matt');
    save('p-marina', 'Marina');
    const family = useDesignerStore.getState().groups.find((group) => group.kind === 'family')!;
    useDesignerStore.getState().toggleGroupMember(family.id, 'p-marina');
    useDesignerStore.getState().removeProfile('p-marina');
    expect(useDesignerStore.getState().groups.every((group) => !group.memberIds.includes('p-marina'))).toBe(true);
    useDesignerStore.getState().removeProfile('p-matt');
    expect(useDesignerStore.getState().meId).toBeNull();
  });

  it('adds guests from a link to a group, never to Solo, and clearAll forgets groups', () => {
    save('p-matt', 'Matt');
    const card = { v: 1 as const, name: 'Sam', loves: ['skiing'], music: [], teams: [], style: [], bucketList: [], sentAt: new Date().toISOString() };
    const { groups, addGuests } = useDesignerStore.getState();
    addGuests(groups.find((group) => group.kind === 'solo')!.id, [card]);
    addGuests(groups.find((group) => group.kind === 'friends')!.id, [card]);
    const after = useDesignerStore.getState().groups;
    expect(after.find((group) => group.kind === 'solo')!.guests).toHaveLength(0);
    expect(after.find((group) => group.kind === 'friends')!.guests.map((guest) => guest.card.name)).toEqual(['Sam']);
    useDesignerStore.getState().clearAll();
    expect(useDesignerStore.getState().groups).toEqual([]);
    expect(useDesignerStore.getState().meId).toBeNull();
  });

  it('migrates a v1 device: the oldest profile is you, with default groups', async () => {
    const options = useDesignerStore.persist.getOptions();
    const migrated = (await options.migrate!({ profiles: [{ id: 'new', profile: profile('Kid') }, { id: 'old', profile: profile('Matt') }] }, 1)) as { meId: string; groups: { kind: string; memberIds: string[] }[] };
    expect(migrated.meId).toBe('old');
    expect(migrated.groups.map((group) => group.kind)).toEqual(['solo', 'family', 'friends']);
    expect(migrated.groups[1].memberIds).toEqual(['old']);
  });
});

describe('account saving stamps and merges (migration 010)', () => {
  it('stamps trip and "you" changes made here, not ones from the account', () => {
    const tokyo = trip('Tokyo');
    useDesignerStore.getState().setTrip(tokyo);
    let state = useDesignerStore.getState();
    expect(state.tripUpdatedAt).toBeTruthy();
    expect(state.youUpdatedAt).toBeTruthy();
    const from = '2026-01-01T00:00:00.000Z';
    state.applySyncedState({ groups: [], meId: null, youUpdatedAt: from, current: { trip: tokyo, votes: {}, activeParticipant: 'p0', joinedAs: null, updatedAt: from }, previous: null });
    state = useDesignerStore.getState();
    expect(state.tripUpdatedAt).toBe(from);
    expect(state.youUpdatedAt).toBe(from);
  });

  it('sets aside a trip open here that the account doesn’t list, instead of losing it', () => {
    const tokyo = trip('Tokyo');
    const lisbon = { ...trip('Lisbon'), id: 'trip-lisbon' };
    useDesignerStore.getState().setTrip(tokyo);
    useDesignerStore.getState().applySyncedState({ groups: [], meId: null, youUpdatedAt: '2026-09-25T00:00:00.000Z', current: { trip: lisbon, votes: {}, activeParticipant: null, joinedAs: null, updatedAt: '2026-09-25T00:00:00.000Z' }, previous: null });
    const state = useDesignerStore.getState();
    expect(state.trip?.id).toBe('trip-lisbon');
    expect(state.previousTrip?.trip.id).toBe(tokyo.id);
  });

  it('resetForAccount clears another account’s data and turns saving on for this one', () => {
    useDesignerStore.getState().setTrip(trip('Tokyo'));
    useDesignerStore.getState().resetForAccount('user-b');
    const state = useDesignerStore.getState();
    expect(state.trip).toBeNull();
    expect(state.profiles).toEqual([]);
    expect(state.groups).toEqual([]);
    expect([state.accountSync, state.syncOwner]).toEqual([true, 'user-b']);
  });
});

describe('a second device signing in (review blocker)', () => {
  it('takes the account’s groups and open trip without overwriting or deleting them', async () => {
    const { localItems, mergeItems, stateFromItems, knownAfterApply, pendingItems, toRemoteState } = await import('@/lib/travelers/stateSync');
    const profile = (name: string) => ({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '', name });
    const saved = [
      { id: 'mb-2', profile: profile('Marina'), engine: 'on-device' as const, updatedAt: '2026-09-20T00:00:00.000Z' },
      { id: 'mb-1', profile: profile('Matt'), engine: 'on-device' as const, updatedAt: '2026-09-19T00:00:00.000Z' },
    ];
    // Device A: two travelers, Family with both, a trip with a vote.
    let store = useDesignerStore.getState();
    store.applySyncedProfiles(saved);
    const family = useDesignerStore.getState().groups.find((group) => group.kind === 'family')!;
    useDesignerStore.getState().toggleGroupMember(family.id, 'mb-2');
    const tokyo = trip('Tokyo');
    useDesignerStore.getState().setTrip(tokyo);
    const slot = tokyo.days[1].slots[0];
    useDesignerStore.getState().vote(slot.id, slot.cardIds[0], 'p0', 1);
    const account = localItems(useDesignerStore.getState()).map(toRemoteState);

    // Device B: fresh, signs in; profiles merge first, then state.
    useDesignerStore.getState().clearAll();
    store = useDesignerStore.getState();
    store.applySyncedProfiles(saved);
    const merged = mergeItems(localItems(useDesignerStore.getState()), account);
    useDesignerStore.getState().applySyncedState(stateFromItems(merged.items));
    const after = useDesignerStore.getState();
    expect(after.groups.find((group) => group.kind === 'family')!.memberIds).toEqual(['mb-1', 'mb-2']);
    expect(after.trip?.id).toBe(tokyo.id);
    expect(after.votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1 });

    // Nothing of A's is pushed back over it, and nothing is tombstoned.
    const known = knownAfterApply(localItems(after), merged);
    const pending = pendingItems(localItems(after), known);
    expect(pending.removed).toEqual([]);
    expect(pending.changed.map((item) => `${item.kind}:${item.id}`)).not.toContain('group:grp-family');
    expect(pending.changed.map((item) => item.kind)).not.toContain('you');
    expect(pending.changed.map((item) => item.kind)).not.toContain('trip');
  });

  it('never tombstones account rows the device couldn’t keep', async () => {
    const { knownAfterApply, pendingItems, localItems } = await import('@/lib/travelers/stateSync');
    const merged = { items: [{ kind: 'group' as const, id: 'grp-unreadable', data: null, updatedAt: '2026-09-20T00:00:00.000Z' }, { kind: 'trip' as const, id: 'old-trip', data: {}, updatedAt: '2026-09-20T00:00:00.000Z' }], push: [] };
    const known = knownAfterApply(localItems(useDesignerStore.getState()), merged);
    expect(pendingItems(localItems(useDesignerStore.getState()), known).removed).toEqual([]);
  });
});

describe('claiming the device on "Not now"', () => {
  it('records the first account only, and turns nothing on', () => {
    useDesignerStore.getState().claimDevice('user-a');
    useDesignerStore.getState().claimDevice('user-b');
    const state = useDesignerStore.getState();
    expect([state.syncOwner, state.accountSync]).toEqual(['user-a', false]);
  });
});

describe('deleting you', () => {
  it('hands the passport on and stamps it, so other devices follow', () => {
    const profile = (name: string) => ({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '', name });
    useDesignerStore.getState().saveProfile({ id: 'p-a', profile: profile('Matt'), engine: 'on-device', updatedAt: '2026-09-01T00:00:00.000Z' });
    useDesignerStore.getState().saveProfile({ id: 'p-b', profile: profile('Marina'), engine: 'on-device', updatedAt: '2026-09-02T00:00:00.000Z' });
    expect(useDesignerStore.getState().youUpdatedAt).toBeNull();
    useDesignerStore.getState().removeProfile('p-a');
    expect(useDesignerStore.getState().meId).toBe('p-b');
    expect(useDesignerStore.getState().youUpdatedAt).toBeTruthy();
  });
});

describe('Codex review follow-ups', () => {
  const profile = (name: string) => ({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '', name });

  it('the group being planned for follows you to another device', () => {
    useDesignerStore.getState().applySyncedProfiles([{ id: 'mb-1', profile: profile('Matt'), engine: 'on-device', updatedAt: '2026-09-19T00:00:00.000Z' }]);
    const groups = useDesignerStore.getState().groups;
    useDesignerStore.getState().applySyncedState({ groups, meId: 'mb-1', activeGroupId: 'grp-friends', youUpdatedAt: '2026-09-25T00:00:00.000Z', current: null, previous: null });
    expect(useDesignerStore.getState().activeGroupId).toBe('grp-friends');
    // Choosing a group here is stamped, so it goes up.
    const before = useDesignerStore.getState().youUpdatedAt;
    useDesignerStore.getState().setActiveGroup('grp-solo');
    expect(useDesignerStore.getState().youUpdatedAt).not.toBe(before);
  });

  it('adopts the time the account stored, without marking anything changed', () => {
    useDesignerStore.getState().saveProfile({ id: 'mb-1', profile: profile('Matt'), engine: 'on-device', updatedAt: '2030-01-01T00:00:00.000Z' });
    useDesignerStore.getState().setTrip(trip('Tokyo'));
    const tripId = useDesignerStore.getState().trip!.id;
    useDesignerStore.getState().restamp('profile', 'mb-1', '2026-09-26T19:00:00.000Z');
    useDesignerStore.getState().restamp('trip', tripId, '2026-09-26T19:00:00.000Z');
    useDesignerStore.getState().restamp('group', 'grp-family', '2026-09-26T19:00:00.000Z');
    const state = useDesignerStore.getState();
    expect(state.profiles[0].updatedAt).toBe('2026-09-26T19:00:00.000Z');
    expect(state.tripUpdatedAt).toBe('2026-09-26T19:00:00.000Z');
    expect(state.groups.find((group) => group.id === 'grp-family')!.updatedAt).toBe('2026-09-26T19:00:00.000Z');
  });
});
