import { describe, expect, it } from 'vitest';
import { composeLocally, participantStyle, type Participant } from '@/lib/designer/itinerary';
import { createGroup } from './groups';
import { EPOCH, knownItems, localItems, mergeItems, pendingItems, readGroup, readTrip, stateFromItems, type RemoteState, type SyncSlice } from './stateSync';

const matt: Participant = { id: 'p0', name: 'Matt', kind: 'adult', tags: [], ...participantStyle(0) };
const trip = (name: string) => composeLocally({ destination: 'custom', place: { name, kind: 'city' }, startDate: '2027-05-10', nights: 2, participants: [matt] }, new Date('2026-09-24T12:00:00Z'));

const base = (patch: Partial<SyncSlice> = {}): SyncSlice => ({
  groups: [], meId: null, trip: null, votes: {}, activeParticipant: null, joinedAs: null, lastMergedAt: {}, previousTrip: null,
  tripUpdatedAt: null, previousTripUpdatedAt: null, youUpdatedAt: null, ...patch,
});

describe('traveler state sync', () => {
  it('lists groups, the open trips and "you" as items', () => {
    const tokyo = trip('Tokyo');
    const family = { ...createGroup('Family', 'family', ['mb-1']), id: 'grp-family', updatedAt: '2026-09-20T00:00:00.000Z' };
    const items = localItems(base({ groups: [family], meId: 'mb-1', trip: tokyo, tripUpdatedAt: '2026-09-21T00:00:00.000Z', youUpdatedAt: '2026-09-21T00:00:00.000Z' }));
    expect(items.map((item) => `${item.kind}:${item.id}`)).toEqual(['group:grp-family', `trip:${tokyo.id}`, 'you:you']);
    expect(items[2].data).toEqual({ meId: 'mb-1', tripId: tokyo.id, previousTripId: null });
  });

  it('a second device picks up the account’s groups and open trip, votes included', () => {
    const tokyo = trip('Tokyo');
    const slot = tokyo.days[1].slots[0];
    const at = '2026-09-22T00:00:00.000Z';
    const remote: RemoteState[] = [
      { kind: 'group', local_id: 'grp-family', data: { name: 'Family', kind: 'family', memberIds: ['mb-1', 'mb-2'], guests: [] }, deleted: false, updated_at: at },
      { kind: 'trip', local_id: tokyo.id, data: { trip: tokyo, votes: { [slot.id]: { [slot.cardIds[0]]: { p0: 1 } } }, activeParticipant: 'p0', joinedAs: null }, deleted: false, updated_at: at },
      { kind: 'you', local_id: 'you', data: { meId: 'mb-1', tripId: tokyo.id, previousTripId: null }, deleted: false, updated_at: at },
    ];
    const { items, push } = mergeItems(localItems(base()), remote);
    expect(push).toEqual([]);
    const state = stateFromItems(items);
    expect(state.groups[0].memberIds).toEqual(['mb-1', 'mb-2']);
    expect(state.meId).toBe('mb-1');
    expect(state.current?.trip.id).toBe(tokyo.id);
    expect(state.current?.votes[slot.id][slot.cardIds[0]]).toEqual({ p0: 1 });
    expect(state.current?.updatedAt).toBe(at);
  });

  it('newer here goes up; a deletion elsewhere that is newer removes it here', () => {
    const family = { ...createGroup('Family', 'family'), id: 'grp-family', updatedAt: '2026-09-23T00:00:00.000Z' };
    const trips = { ...createGroup('Ski crew', 'custom'), id: 'grp-ski', updatedAt: '2026-09-20T00:00:00.000Z' };
    const remote: RemoteState[] = [
      { kind: 'group', local_id: 'grp-family', data: { name: 'Old family', kind: 'family' }, deleted: false, updated_at: '2026-09-01T00:00:00.000Z' },
      { kind: 'group', local_id: 'grp-ski', data: {}, deleted: true, updated_at: '2026-09-22T00:00:00.000Z' },
    ];
    const { items, push } = mergeItems(localItems(base({ groups: [family, trips] })), remote);
    expect(items.some((item) => item.id === 'grp-ski')).toBe(false);
    expect(push.map((item) => item.id)).toEqual(['grp-family', 'you']);
  });

  it('sends changes and tombstones for what left this device', () => {
    const tokyo = trip('Tokyo');
    const before = localItems(base({ trip: tokyo, tripUpdatedAt: '2026-09-21T00:00:00.000Z' }));
    const known = knownItems(before, []);
    const after = localItems(base({ youUpdatedAt: '2026-09-22T00:00:00.000Z' }));
    const pending = pendingItems(after, known);
    expect(pending.changed.map((item) => item.kind)).toEqual(['you']);
    expect(pending.removed).toEqual([{ kind: 'trip', id: tokyo.id }]);
  });

  it('checks what comes back from the account', () => {
    expect(readGroup({ name: '<b>x</b>', kind: 'owner', memberIds: ['ok', 'bad id!', 7], guests: [{ id: 'g1', card: { v: 1, name: '' } }, { id: 'g2', card: { v: 1, name: 'Sam', loves: ['<script>'], age: 40 } }] }, 'grp-x')).toEqual({
      id: 'grp-x', name: 'b x /b', kind: 'custom', memberIds: ['ok'], guests: [{ id: 'g2', card: expect.objectContaining({ name: 'Sam', loves: ['script'] }), addedAt: EPOCH }], updatedAt: EPOCH,
    });
    expect(readGroup({}, 'bad id!')).toBeNull();
    expect(readTrip({ trip: { id: 'x' } })).toBeNull();
    const tokyo = trip('Tokyo');
    const row = readTrip({ trip: { ...tokyo, joinedFrom: 'Sam' }, votes: 'nope', activeParticipant: 'someone-else', joinedAs: 'p0' });
    expect(row?.trip.joinedFrom).toBe('Sam');
    expect(row?.votes).toEqual({});
    expect(row?.activeParticipant).toBeNull();
    expect(row?.joinedAs).toBe('p0');
  });
});
