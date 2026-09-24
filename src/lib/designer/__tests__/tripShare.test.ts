import { describe, expect, it } from 'vitest';
import { composeLocally, participantStyle, type Itinerary, type Participant } from '../itinerary';
import {
  LinkError,
  NEUTRAL_NIGHT_BLURB,
  checkReply,
  cleanText,
  isSafeId,
  linkHint,
  mergeReply,
  packPayload,
  readReplyLink,
  readTripLink,
  replyFor,
  replyLink,
  safeCardLink,
  sanitizeTrip,
  tripLink,
  unpackPayload,
} from '../tripShare';

const people: Participant[] = [
  { id: 'p0', name: 'Matt', kind: 'adult', age: 41, tags: ['music', 'nightlife', 'food'], ...participantStyle(0) },
  { id: 'p1', name: 'Kelly', kind: 'adult', age: 39, tags: ['water', 'hearty'], ...participantStyle(1) },
  { id: 'p2', name: 'Leo', kind: 'kid', age: 7, tags: ['kids'], ...participantStyle(2) },
];

const TASTE = { genres: ['hip hop', 'trap', 'classic rock', 'rock'], topArtists: ['Foo Fighters'], eras: [{ decade: '1970s', share: 0.6 }], energy: 'high' as const };

function lisbon(): Itinerary {
  const trip = composeLocally(
    {
      destination: 'custom',
      place: { name: 'Lisbon', region: 'Portugal', kind: 'city' },
      startDate: '2027-05-10',
      nights: 3,
      participants: people,
      foods: ['seafood'],
      taste: TASTE,
    },
    new Date('2026-09-24T12:00:00Z'),
  );
  return { ...trip, taste: TASTE };
}

const fragment = (link: string, key: 't' | 'r') => new URLSearchParams(link.split('#')[1]).get(key)!;

/** A payload with hostile own keys, exactly as JSON.parse builds them from a crafted link. */
const crafted = (json: string) => packPayload(JSON.parse(json));

describe('prototype pollution (K06)', () => {
  it('refuses ids that name Object.prototype members', () => {
    for (const bad of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', 'valueOf']) expect(isSafeId(bad)).toBe(false);
    expect(isSafeId('p0')).toBe(true);
    expect(isSafeId('custom:3')).toBe(true);
    expect(isSafeId('d1-late')).toBe(true);
  });

  it('decoding a crafted invite leaves Object.prototype untouched', async () => {
    const trip = JSON.stringify(sanitizeTrip(lisbon()));
    const packed = await crafted(
      `{"v":1,"trip":${trip},"votes":{"__proto__":{"rtkPolluted":{"p0":1}},"constructor":{"prototype":{"x":1}},"d1-late":{"__proto__":{"p0":1},"custom:1":{"__proto__":1,"toString":1,"p0":1}}},"organizer":"__proto__"}`,
    );
    const opened = await readTripLink(packed);
    expect(({} as Record<string, unknown>).rtkPolluted).toBeUndefined();
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(({} as Record<string, unknown>).p0).toBeUndefined();
    expect(Object.keys(opened.votes)).toEqual(['d1-late']);
    expect({ ...opened.votes['d1-late']['custom:1'] }).toEqual({ p0: 1 });
    expect(opened.organizer).toBeUndefined();
  });

  it('decoding and merging a crafted reply leaves Object.prototype untouched', async () => {
    const trip = lisbon();
    const packed = await crafted(
      `{"v":1,"tripId":"${trip.id}","participant":{"id":"g-1","name":"Sam"},"votes":{"__proto__":{"rtkReply":1},"toString":{"custom:1":1},"d1-late":{"__proto__":-1}}}`,
    );
    const reply = await readReplyLink(packed);
    expect(Object.keys(reply.votes)).toEqual([]);
    mergeReply(trip, {}, reply);
    expect(({} as Record<string, unknown>).rtkReply).toBeUndefined();
    await expect(readReplyLink(await crafted(`{"v":1,"tripId":"${trip.id}","participant":{"id":"__proto__","name":"x"},"votes":{}}`))).rejects.toThrow(/damaged/);
  });
});

describe('untrusted card links and text (K08)', () => {
  it('keeps only the hosts the app links to, with host-derived labels', () => {
    expect(safeCardLink({ href: 'https://dope.travel.evil.example/login', label: 'Sign in to dope.travel' })).toBeUndefined();
    expect(safeCardLink({ href: 'https://evil.example/', label: 'x' })).toBeUndefined();
    expect(safeCardLink({ href: 'http://www.google.com/maps/search/?api=1&query=x' })).toBeUndefined();
    expect(safeCardLink({ href: 'https://www.google.com/url?q=https://evil.example' })).toBeUndefined();
    expect(safeCardLink({ href: 'https://www.youtube.com/redirect?q=https://evil.example' })).toBeUndefined();
    expect(safeCardLink({ href: 'https://user@www.google.com/maps/search/?api=1' })).toBeUndefined();
    expect(safeCardLink({ href: 'https://www.google.com/maps/search/?api=1&query=bar', label: 'Sign in to dope.travel' })).toEqual({
      href: 'https://www.google.com/maps/search/?api=1&query=bar',
      label: 'Search Maps',
    });
    expect(safeCardLink({ href: 'https://www.instagram.com/explore/tags/lisbon/', label: '#lisbon on Instagram' })?.label).toBe('#lisbon on Instagram');
    expect(safeCardLink({ href: 'https://www.instagram.com/explore/tags/lisbon/', label: 'Log in' })?.label).toBe('Instagram');
    expect(safeCardLink({ href: 'https://www.youtube.com/results?search_query=lisbon' })?.label).toBe('Watch on YouTube');
  });

  it('keeps every link a composed trip makes', () => {
    const trip = lisbon();
    const clean = sanitizeTrip(JSON.parse(JSON.stringify(trip)));
    expect(clean.cards?.map((c) => c.link?.href)).toEqual(trip.cards?.map((c) => c.link?.href));
  });

  it('strips control and format characters but keeps emoji sequences', () => {
    expect(cleanText('‮yaM')).toBe('yaM');
    expect(cleanText('Maya​')).toBe('Maya');
    expect(cleanText('Sa\u0000m\n')).toBe('Sam');
    expect(cleanText('Zoë 👩‍🚀 مريم')).toBe('Zoë 👩‍🚀 مريم');
    const evil = JSON.parse(JSON.stringify(lisbon()));
    evil.participants[1].name = '‮yaM​';
    evil.days[0].title = 'Day⁦ one';
    const clean = sanitizeTrip(evil);
    expect(clean.participants[1].name).toBe('yaM');
    expect(clean.days[0].title).toBe('Day one');
  });
});

describe('what an invite carries (G03, F08)', () => {
  it('drops taste, taste-derived copy, interest tags and adults’ ages; keeps kids’ ages', async () => {
    const trip = lisbon();
    // Sanity: the organizer's own cards are taste-derived.
    expect(JSON.stringify(trip.cards)).toMatch(/listen|top songs|classics/i);
    const link = await tripLink('https://dope.travel', trip, {}, 'Matt');
    const opened = await readTripLink(fragment(link, 't'));
    const text = JSON.stringify(opened);
    expect(text).not.toMatch(/listen|top songs|classics/i);
    expect(text).not.toContain('Foo Fighters');
    expect(opened.trip.taste).toBeUndefined();
    expect(opened.trip.cards?.some((card) => card.blurb === NEUTRAL_NIGHT_BLURB)).toBe(true);
    for (const person of opened.trip.participants) expect(person.tags).toEqual([]);
    expect(opened.trip.participants.map((p) => p.age)).toEqual([undefined, undefined, 7]);
    // The raw payload, not just the sanitized result.
    const raw = (await unpackPayload(fragment(link, 't'))) as { trip: { participants: Participant[]; taste?: unknown } };
    expect(JSON.stringify(raw)).not.toMatch(/listen|top songs|classics|"taste"/i);
    expect(raw.trip.participants.map((p) => [p.tags, p.age])).toEqual([[[], undefined], [[], undefined], [[], 7]]);
  });

  it('marks the organizer and names the sender outside the payload', async () => {
    const link = await tripLink('https://dope.travel', lisbon(), {}, 'Matt');
    expect(linkHint(link.split('#')[1])).toBe('Matt');
    expect((await readTripLink(fragment(link, 't'))).organizer).toBe('p0');
  });

  it('keeps taste only in a self-handoff (H12)', async () => {
    const trip = lisbon();
    const handoff = await readTripLink(fragment(await tripLink('https://dope.travel', trip, {}, 'Matt', { handoff: true, includeTaste: true }), 't'));
    expect(handoff.handoff).toBe(true);
    expect(handoff.organizer).toBeUndefined();
    expect(handoff.trip.taste?.genres).toEqual(TASTE.genres);
    expect(handoff.trip.taste?.eras).toEqual(TASTE.eras);
    expect(handoff.trip.participants[0].tags).toEqual(people[0].tags);
    expect(JSON.stringify(handoff.trip.cards)).toMatch(/listen/);
    // Not without handoff, and not without asking.
    const plainHandoff = await readTripLink(fragment(await tripLink('https://dope.travel', trip, {}, 'Matt', { handoff: true }), 't'));
    expect(plainHandoff.trip.taste).toBeUndefined();
    const invite = await readTripLink(fragment(await tripLink('https://dope.travel', trip, {}, 'Matt', { includeTaste: true }), 't'));
    expect(invite.trip.taste).toBeUndefined();
    // A crafted invite that smuggles taste in is ignored.
    const smuggled = await readTripLink(await packPayload({ v: 1, trip: { ...sanitizeTrip(trip), taste: TASTE }, votes: {} }));
    expect(smuggled.trip.taste).toBeUndefined();
  });
});

describe('broken links (G08, G12)', () => {
  it('a cut-off invite or picks link says it is incomplete, never a raw browser error', async () => {
    const invite = await tripLink('https://dope.travel', lisbon(), {}, 'Matt');
    const packed = fragment(invite, 't');
    const reply = fragment(await replyLink('https://dope.travel', replyFor(lisbon(), {}, 'p1')), 'r');
    for (const cut of [packed.slice(0, packed.length / 2), packed.slice(0, -3), packed.slice(0, -1), reply.slice(0, reply.length / 2), reply.slice(0, -3), `${packed.slice(0, 40)}!!`]) {
      const read = cut === reply.slice(0, reply.length / 2) || cut === reply.slice(0, -3) ? readReplyLink(cut) : readTripLink(cut);
      const error = await read.then(
        () => null,
        (cause: unknown) => cause,
      );
      expect(error).toBeInstanceOf(LinkError);
      expect((error as LinkError).message).not.toMatch(/atob|Window|fetch|JSON|Unexpected/);
      expect((error as LinkError).kind).toMatch(/incomplete|damaged/);
    }
    expect(linkHint('f=Matt&t=zAbC')).toBe('Matt');
    expect(linkHint('f=%E2%80%AEyaM&t=')).toBe('yaM');
  });

  it('rejects a deflate bomb without inflating all of it', async () => {
    const bomb = await packPayload({ v: 1, pad: 'x'.repeat(20_000_000) });
    expect(bomb.length).toBeLessThan(60_000);
    const started = performance.now();
    await expect(readTripLink(bomb)).rejects.toMatchObject({ kind: 'too-large' });
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe('merging picks (G01, G05, G06, G09, G11, K07)', () => {
  function withGuest(trip: Itinerary, guest: Participant) {
    return { ...trip, participants: [...trip.participants, guest] };
  }
  const sam: Participant = { id: 'g-sam', name: 'Sam', kind: 'adult', age: 30, tags: ['nightlife'], ...participantStyle(3) };

  it('replies carry the time, the trip, and nothing personal beyond name and votes', async () => {
    const trip = withGuest(lisbon(), sam);
    const slot = trip.days[1].slots[0];
    const reply = replyFor(trip, { [slot.id]: { [slot.cardIds[0]]: { 'g-sam': 1, p0: -1 } } }, 'g-sam', new Date('2026-09-24T10:05:00Z'));
    expect(reply).toMatchObject({ at: '2026-09-24T10:05:00.000Z', place: 'Lisbon', startDate: '2027-05-10' });
    expect(reply.participant.tags).toEqual([]);
    expect(reply.participant.age).toBeUndefined();
    const link = await replyLink('https://dope.travel', reply);
    expect(linkHint(link.split('#')[1])).toBe('Sam');
    const decoded = await readReplyLink(fragment(link, 'r'));
    expect(decoded).toMatchObject({ at: reply.at, place: 'Lisbon', startDate: '2027-05-10' });
    // A time from the future is clamped so it can't make every later link look stale.
    const future = await readReplyLink(await packPayload({ v: 1, ...reply, at: '2099-01-01T00:00:00Z' }), new Date('2026-09-24T12:00:00Z'));
    expect(future.at).toBe('2026-09-24T12:00:00.000Z');
  });

  it('counts what landed, what was dropped, and what gets replaced', () => {
    const trip = lisbon();
    const [a, b] = trip.days[1].slots;
    const reply = {
      tripId: trip.id,
      participant: sam,
      votes: { [a.id]: { [a.cardIds[0]]: 1 as const, 'custom:999': 1 as const }, [b.id]: { [b.cardIds[0]]: -1 as const } },
    };
    const first = mergeReply(trip, {}, reply);
    expect(first.summary).toMatchObject({ loves: 1, passes: 1, dropped: 1, replaced: 0, added: true, name: 'Sam' });
    const again = mergeReply(first.trip, first.votes, reply);
    expect(again.summary).toMatchObject({ loves: 1, passes: 1, dropped: 1, replaced: 2, added: false });
  });

  it('flags a reply that claims the organizer, a name that doesn’t match, and a same-name newcomer', () => {
    const trip = withGuest(lisbon(), sam);
    const slot = trip.days[1].slots[0];
    const votes = { [slot.id]: { [slot.cardIds[0]]: { p0: 1 as const } } };
    const asMatt = checkReply(trip, votes, { tripId: trip.id, participant: { ...people[0] }, votes: { [slot.id]: { [slot.cardIds[0]]: -1 } } });
    expect(asMatt.organizer).toBe(true);
    expect(asMatt.preview.replaced).toBe(1);
    const spoof = checkReply(trip, votes, { tripId: trip.id, participant: { ...people[0], name: 'Sam' }, votes: {} });
    expect(spoof).toMatchObject({ organizer: true, nameMismatch: true });
    expect(spoof.known?.name).toBe('Matt');
    const kellyAsSam = checkReply(trip, votes, { tripId: trip.id, participant: { ...people[1], name: 'Sam' }, votes: {} });
    expect(kellyAsSam).toMatchObject({ organizer: false, nameMismatch: true });
    const twin = checkReply(trip, votes, { tripId: trip.id, participant: { ...sam, id: 'g-other', name: ' sam ' }, votes: {} });
    expect(twin.duplicateOf?.id).toBe('g-sam');
    expect(checkReply(trip, votes, { tripId: trip.id, participant: sam, votes: {} })).toMatchObject({ organizer: false, nameMismatch: false });
  });

  it('combines a same-name newcomer into the existing traveler when asked', () => {
    const trip = withGuest(lisbon(), sam);
    const slot = trip.days[1].slots[0];
    const merged = mergeReply(trip, {}, { tripId: trip.id, participant: { ...sam, id: 'g-other' }, votes: { [slot.id]: { [slot.cardIds[0]]: 1 } } }, { as: 'g-sam' });
    expect(merged.added).toBe(false);
    expect(merged.trip.participants).toHaveLength(trip.participants.length);
    expect(merged.votes[slot.id][slot.cardIds[0]]).toEqual({ 'g-sam': 1 });
  });

  it('gives a new traveler a style nobody else has', () => {
    const trip = withGuest(lisbon(), sam);
    const twin = { ...sam, id: 'g-priya2', name: 'Priya' };
    const merged = mergeReply(trip, {}, { tripId: trip.id, participant: twin, votes: {} });
    const added = merged.trip.participants.at(-1)!;
    expect(added.name).toBe('Priya');
    expect(trip.participants.map((p) => p.color)).not.toContain(added.color);
    expect(trip.participants.map((p) => p.emoji)).not.toContain(added.emoji);
    expect(added.tags).toEqual([]);
  });

  it('flags an older picks link than one already added', () => {
    const trip = withGuest(lisbon(), sam);
    const older = { tripId: trip.id, participant: sam, votes: {}, at: '2026-09-24T10:02:00Z' };
    expect(checkReply(trip, {}, older, { 'g-sam': '2026-09-24T10:05:00.000Z' }).newerMergedAt).toBe('2026-09-24T10:05:00.000Z');
    expect(checkReply(trip, {}, { ...older, at: '2026-09-24T10:06:00Z' }, { 'g-sam': '2026-09-24T10:05:00.000Z' }).newerMergedAt).toBeUndefined();
    expect(checkReply(trip, {}, { ...older, at: undefined }, { 'g-sam': '2026-09-24T10:05:00.000Z' }).newerMergedAt).toBeUndefined();
  });
});
