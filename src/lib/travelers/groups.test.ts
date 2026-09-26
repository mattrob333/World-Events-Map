import { describe, expect, it } from 'vitest';
import { emptyProfile, type TravelerProfile } from '@/lib/designer/profile';
import { cardFromProfile } from '@/lib/people/card';
import { addGuests, createGroup, fitInvite, decodeInvite, encodeInvite, ensureDefaultGroups, groupTravelers, inviteFromGroup, inviteUrl } from './groups';

const person = (patch: Partial<TravelerProfile>): TravelerProfile => ({ ...emptyProfile(), ...patch });

const matt = { id: 'p-matt', profile: person({ name: 'Matt', age: 44, hometown: 'Atlanta', teams: ['Atlanta Braves'], family: [
  { relation: 'partner', label: 'wife', name: 'Marina' },
  { relation: 'child', label: 'son', name: 'Leo', age: 8 },
  { relation: 'child', label: 'son', age: 12 },
] }) };
const marina = { id: 'p-marina', profile: person({ name: 'Marina', hometown: 'Atlanta', food: ['ramen'] }) };
const leo = { id: 'p-leo', profile: person({ name: 'Leo', age: 8, interests: ['dinosaurs'] }) };

describe('ensureDefaultGroups', () => {
  it('makes Solo, Family and Friends, each led by you', () => {
    const groups = ensureDefaultGroups([], 'p-matt', ['p-matt']);
    expect(groups.map((group) => group.kind)).toEqual(['solo', 'family', 'friends']);
    expect(groups.every((group) => group.memberIds[0] === 'p-matt')).toBe(true);
  });

  it('drops members whose profile is gone and keeps Solo to you alone', () => {
    const family = { ...createGroup('Family', 'family', ['p-matt', 'p-gone', 'p-marina']) };
    const solo = { ...createGroup('Solo', 'solo', ['p-matt', 'p-marina']) };
    const groups = ensureDefaultGroups([solo, family], 'p-matt', ['p-matt', 'p-marina']);
    expect(groups.find((group) => group.kind === 'family')!.memberIds).toEqual(['p-matt', 'p-marina']);
    expect(groups.find((group) => group.kind === 'solo')!.memberIds).toEqual(['p-matt']);
  });

  it('works before anyone has a profile', () => {
    expect(ensureDefaultGroups([], null, []).every((group) => group.memberIds.length === 0)).toBe(true);
  });
});

describe('groupTravelers', () => {
  it('Solo is just you, without the household roster', () => {
    const solo = createGroup('Solo', 'solo', ['p-matt']);
    expect(groupTravelers(solo, [matt]).map((t) => t.name)).toEqual(['Matt']);
  });

  it('Family fills in people without their own profile, and never lists anyone twice', () => {
    const family = createGroup('Family', 'family', ['p-matt', 'p-marina', 'p-leo']);
    const travelers = groupTravelers(family, [matt, marina, leo]);
    expect(travelers.map((t) => t.name)).toEqual(['Matt', 'Marina', 'Leo', 'son (12)']);
    expect(travelers.find((t) => t.name === 'Leo')!.kind).toBe('kid');
    expect(travelers.find((t) => t.name === 'son (12)')!.kind).toBe('kid');
  });

  it('adds guests from another family, kids as kids', () => {
    const theirs = [cardFromProfile(person({ name: 'Sam', hometown: 'Denver', interests: ['skiing'] }), 'Sam'), cardFromProfile(person({ name: 'Ivy', age: 9 }), 'Ivy')];
    const friends = addGuests(createGroup('Friends', 'friends', ['p-matt']), theirs);
    const travelers = groupTravelers(friends, [matt]);
    expect(travelers.map((t) => [t.name, t.kind])).toEqual([['Matt', 'adult'], ['Sam', 'adult'], ['Ivy', 'kid']]);
    expect(travelers[1].board).toBeUndefined();
  });

  it('refreshes a guest sent again instead of doubling them', () => {
    const card = cardFromProfile(person({ name: 'Sam', hometown: 'Denver' }), 'Sam');
    const once = addGuests(createGroup('Friends', 'friends'), [card]);
    const twice = addGuests(once, [{ ...card, loves: ['tacos'] }]);
    expect(twice.guests).toHaveLength(1);
    expect(twice.guests[0].card.loves).toEqual(['tacos']);
  });
});

describe('group invites', () => {
  it('round-trips through a link fragment as cards only', () => {
    const family = createGroup('The Robersons', 'custom', ['p-matt', 'p-leo']);
    const invite = inviteFromGroup(family, [matt, leo], (entry) => entry.profile.name ?? 'Traveler');
    const url = inviteUrl('https://dope.travel/', invite);
    expect(url).toMatch(/^https:\/\/dope\.travel\/vibe\/group#g=[A-Za-z0-9_-]+$/);
    const back = decodeInvite(url.split('#g=')[1]);
    expect(back?.name).toBe('The Robersons');
    expect(back?.cards.map((card) => card.name)).toEqual(['Matt', 'Leo']);
    expect(back?.cards[1].kid).toBe(true);
    // Cards never carry ages or family names.
    expect(JSON.stringify(back)).not.toMatch(/"age"|Marina/);
  });

  it('names a default group after its leader', () => {
    const family = createGroup('Family', 'family', ['p-matt', 'p-leo']);
    expect(inviteFromGroup(family, [matt, leo], (entry) => entry.profile.name ?? '').name).toBe('Matt’s family');
  });

  it('always makes a link the decoder accepts, however full the profiles', () => {
    const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix} ${'x'.repeat(50)} ${i}`);
    const card = (i: number) => ({ v: 1 as const, name: `Traveler number ${i} with a long name`, hometown: 'A very long home city name, Some Region', loves: many('love', 8), music: many('band', 8), teams: many('team', 4), style: many('style', 3), bucketList: many('dream', 5), sentAt: new Date().toISOString() });
    const invite = fitInvite({ v: 1, name: 'Big crew', cards: Array.from({ length: 12 }, (_, i) => card(i)), sentAt: new Date().toISOString() });
    const back = decodeInvite(encodeInvite(invite));
    expect(back).not.toBeNull();
    expect(back!.cards.length).toBe(invite.cards.length);
    expect(invite.cards.length).toBeGreaterThan(1);
  });

  it('rejects damaged or hostile links', () => {
    expect(decodeInvite('')).toBeNull();
    expect(decodeInvite('not a link!')).toBeNull();
    expect(decodeInvite('x'.repeat(30000))).toBeNull();
    const bad = btoa(JSON.stringify({ v: 1, name: '<script>', cards: ['@@@'] })).replace(/=+$/, '');
    expect(decodeInvite(bad)).toBeNull();
    const card = cardFromProfile(person({ name: 'Sam' }), 'Sam');
    const named = decodeInvite(encodeInvite({ v: 1, name: '<b>Evil</b>', cards: [card], sentAt: 'x' }));
    expect(named?.name).not.toMatch(/[<>]/);
  });
});
