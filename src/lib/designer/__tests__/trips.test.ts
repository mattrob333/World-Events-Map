import { describe, expect, it } from 'vitest';
import { cardLookup, composeLocally, participantStyle, resolveDestination, type Participant } from '../itinerary';
import { parsePlaylistRef, playlistArtists, analyzeSpotify } from '../listening';
import { placeCards } from '../place';
import { readPlaylist, type SpotifyGet } from '../spotifyRead';
import { bedroomsFor, partyFrom, staySearches } from '../stays';
import { slotForTime, tripMoment } from '../tripNow';
import { mergeReply, readReplyLink, readTripLink, replyFor, replyLink, sanitizeTrip, tripLink } from '../tripShare';

const people: Participant[] = [
  { id: 'p0', name: 'Matt', kind: 'adult', tags: ['music', 'nightlife'], ...participantStyle(0) },
  { id: 'p1', name: 'Ana', kind: 'adult', tags: [], ...participantStyle(1) },
  { id: 'p2', name: 'Leo', kind: 'kid', age: 6, tags: [], ...participantStyle(2) },
];

function lisbon() {
  return composeLocally(
    {
      destination: 'custom',
      place: { name: 'Lisbon', region: 'Portugal', kind: 'city' },
      startDate: '2027-05-10',
      nights: 3,
      participants: people,
      foods: ['seafood'],
      taste: { genres: ['classic rock'], topArtists: ['Foo Fighters'] },
    },
    new Date('2026-09-24T12:00:00Z'),
  );
}

describe('trips anywhere', () => {
  it('lays out a typed-in place with search-backed cards and no invented venues', () => {
    const trip = lisbon();
    expect(trip.destination).toBe('custom');
    expect(resolveDestination(trip)?.name).toBe('Lisbon');
    expect(trip.days).toHaveLength(4);
    const lookup = cardLookup(trip);
    const leads = trip.days.flatMap((d) => d.slots).filter((s) => s.cardIds.length).map((s) => lookup(s.cardIds[0]));
    expect(leads.every(Boolean)).toBe(true);
    for (const card of trip.cards ?? []) expect(card.link?.href).toMatch(/^https:\/\/(www\.google\.com\/maps|www\.youtube\.com|www\.instagram\.com)\//);
    const titles = (trip.cards ?? []).map((c) => c.title).join(' | ');
    expect(titles).toContain('seafood in Lisbon');
    expect(titles).toMatch(/Rock|rock/);
    expect(titles).toContain('Lisbon with kids');
  });

  it('keeps late nights for city trips and uses travel notes without a gateway', () => {
    const trip = lisbon();
    expect(trip.days[1].slots.some((s) => s.kind === 'late')).toBe(true);
    expect(trip.days[0].slots.find((s) => s.kind === 'flight')?.note).toContain('→ Lisbon');
  });

  it('still composes curated destinations', () => {
    const trip = composeLocally({ destination: 'aspen', startDate: '2027-01-10', nights: 2, participants: people });
    expect(trip.cards).toBeUndefined();
    expect(resolveDestination(trip)?.name).toBe('Aspen');
  });

  it('ski places get ski cards', () => {
    const cards = placeCards({ name: 'Niseko', kind: 'ski' }, { tags: [] });
    expect(cards.some((c) => c.slots.includes('apres') && /Après/.test(c.title))).toBe(true);
  });
});

describe('stays', () => {
  it('sizes searches to the party', () => {
    const party = partyFrom(people);
    expect(party).toEqual({ adults: 2, kids: 1, kidAges: [6] });
    expect(bedroomsFor(party)).toBe(2);
    const [airbnb, vrbo, booking] = staySearches({ place: 'Lisbon, Portugal', checkIn: '2027-05-10', nights: 3, party });
    expect(airbnb.href).toContain('checkin=2027-05-10');
    expect(airbnb.href).toContain('checkout=2027-05-13');
    expect(airbnb.href).toContain('adults=2');
    expect(airbnb.href).toContain('children=1');
    expect(airbnb.href).toContain('min_bedrooms=2');
    expect(vrbo.href).toContain('children=1_6');
    expect(booking.href).toContain('group_children=1');
    expect(booking.href).toContain('age=6');
  });

  it('offers hostels only to adult crews who like them', () => {
    const adults = { adults: 3, kids: 0, kidAges: [] };
    expect(staySearches({ place: 'Mexico City', checkIn: '2027-02-01', nights: 4, party: adults, lodging: ['social hostel'] }).map((s) => s.id)).toContain('hostelworld');
    expect(staySearches({ place: 'Mexico City', checkIn: '2027-02-01', nights: 4, party: partyFrom(people), lodging: ['hostel'] }).map((s) => s.id)).not.toContain('hostelworld');
  });
});

describe('share and join', () => {
  it('round-trips a trip and its votes through the link, dropping music taste', async () => {
    const trip = { ...lisbon(), taste: { genres: ['rock'] } };
    const slot = trip.days[1].slots[0];
    const votes = { [slot.id]: { [slot.cardIds[0]]: { p0: 1 as const } } };
    const link = await tripLink('https://dope.travel', trip, votes, 'Matt');
    expect(link).toMatch(/^https:\/\/dope\.travel\/trips\/join#t=z[A-Za-z0-9_-]+$/);
    expect(link.length).toBeLessThan(20_000);
    const opened = await readTripLink(link.split('#t=')[1]);
    expect(opened.from).toBe('Matt');
    expect(opened.handoff).toBe(false);
    expect(opened.trip.taste).toBeUndefined();
    expect(opened.trip.cards).toEqual(trip.cards);
    expect(opened.votes).toEqual(votes);
  });

  it('merges a friend’s picks back, following moved cards and adding new people', async () => {
    const trip = lisbon();
    const slot = trip.days[1].slots[0];
    const card = slot.cardIds[1];
    const guest = { ...trip, participants: [...trip.participants, { id: 'g-1', name: 'Sam', kind: 'adult' as const, tags: [], ...participantStyle(3) }] };
    const reply = replyFor(guest, { [slot.id]: { [card]: { 'g-1': 1, p0: -1 } } }, 'g-1');
    expect(reply.votes).toEqual({ [slot.id]: { [card]: 1 } });
    const decoded = await readReplyLink((await replyLink('https://dope.travel', reply)).split('#r=')[1]);
    // The organizer moved that card to another slot before the reply came back.
    const target = trip.days[1].slots.find((s) => s.id !== slot.id && !s.cardIds.includes(card))!;
    const moved = {
      ...trip,
      days: trip.days.map((d) => ({
        ...d,
        slots: d.slots.map((s) => (s.id === slot.id ? { ...s, cardIds: s.cardIds.filter((c) => c !== card) } : s.id === target.id ? { ...s, cardIds: [card, ...s.cardIds] } : s)),
      })),
    };
    const merged = mergeReply(moved, {}, decoded);
    expect(merged.added).toBe(true);
    expect(merged.trip.participants.map((p) => p.name)).toContain('Sam');
    expect(merged.votes[target.id][card]).toEqual({ 'g-1': 1 });
    expect(() => mergeReply({ ...trip, id: 'trip-other' }, {}, decoded)).toThrow(/different trip/);
  });

  it('treats links as untrusted: no javascript: links, no css injection, no unknown destinations', () => {
    const trip = lisbon();
    const evil = JSON.parse(JSON.stringify(trip));
    evil.cards[0].link = { href: 'javascript:alert(1)', label: 'x' };
    evil.cards[1].palette = ['red;background:url(https://evil.test/x)', '#fff'];
    evil.cards[2].image = 'https://evil.test/track.png';
    evil.participants[0].color = 'url(https://evil.test)';
    const clean = sanitizeTrip(evil);
    expect(clean.cards?.[0].link).toBeUndefined();
    expect(clean.cards?.[1].palette[0]).toMatch(/^#/);
    expect(clean.cards?.[2].image).toBeUndefined();
    expect(clean.participants[0].color).toMatch(/^#/);
    expect(() => sanitizeTrip({ ...trip, destination: 'atlantis' })).toThrow();
    expect(() => sanitizeTrip({ ...trip, place: undefined })).toThrow();
  });

  it('rejects damaged and oversized links', async () => {
    await expect(readTripLink('x123')).rejects.toThrow();
    await expect(readTripLink(`j${'A'.repeat(70_000)}`)).rejects.toThrow(/too long/);
    await expect(readTripLink(`j${btoa(JSON.stringify({ v: 2 }))}`)).rejects.toThrow();
  });
});

describe('right now', () => {
  it('finds today’s slot during the trip only', () => {
    const trip = lisbon();
    expect(tripMoment(trip, new Date(2027, 4, 9, 20, 0))).toBeNull();
    const evening = tripMoment(trip, new Date(2027, 4, 11, 19, 45));
    expect(evening?.day.index).toBe(1);
    expect(evening?.current?.kind).toBe('dinner');
    expect(evening?.next?.kind).toBe('late');
    expect(evening?.tonight).toBe(true);
  });

  it('maps the clock to a slot', () => {
    expect(slotForTime(new Date(2027, 0, 1, 9, 0))).toBe('morning');
    expect(slotForTime(new Date(2027, 0, 1, 12, 30))).toBe('lunch');
    expect(slotForTime(new Date(2027, 0, 1, 20, 0))).toBe('dinner');
    expect(slotForTime(new Date(2027, 0, 1, 1, 0))).toBe('late');
  });
});

describe('spotify playlist links', () => {
  it('parses playlist links, URIs, and Liked Songs', () => {
    expect(parsePlaylistRef('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc')).toEqual({ kind: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
    expect(parsePlaylistRef('https://open.spotify.com/intl-pt/playlist/37i9dQZF1DXcBWIGoYBM5M')).toEqual({ kind: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
    expect(parsePlaylistRef('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toEqual({ kind: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M' });
    expect(parsePlaylistRef('liked')).toEqual({ kind: 'liked' });
    expect(parsePlaylistRef('https://open.spotify.com/collection/tracks')).toEqual({ kind: 'liked' });
    expect(parsePlaylistRef('https://evil.test/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBeNull();
    expect(parsePlaylistRef('https://open.spotify.com/playlist/../../me')).toBeNull();
  });

  it('reads a playlist, ranks its artists, and leads the profile with them', async () => {
    const pages: Record<string, unknown> = {
      '/playlists/abcdefghijklmnop1234?fields=name': { name: 'Road Trip Rock' },
      '/playlists/abcdefghijklmnop1234/items?limit=100': {
        items: [
          { item: { album: { release_date: '1977-02-04' }, artists: [{ id: 'fleetwood00', name: 'Fleetwood Mac' }] } },
          { item: { album: { release_date: '1979-01-01' }, artists: [{ id: 'fleetwood00', name: 'Fleetwood Mac' }] } },
        ],
        next: 'https://api.spotify.com/v1/playlists/abcdefghijklmnop1234/items?offset=2',
      },
      'https://api.spotify.com/v1/playlists/abcdefghijklmnop1234/items?offset=2': {
        items: [{ track: { album: { release_date: '1985-06-01' }, artists: [{ id: 'direstraits', name: 'Dire Straits' }] } }, { item: null }],
        next: 'https://evil.test/next',
      },
      '/artists/fleetwood00': { genres: ['soft rock', 'classic rock'] },
      '/artists/direstraits': { genres: ['album rock'] },
    };
    const get: SpotifyGet = async <T>(path: string) => (pages[path] as T) ?? null;
    const focus = await readPlaylist(get, { kind: 'playlist', id: 'abcdefghijklmnop1234' });
    expect(focus?.name).toBe('Road Trip Rock');
    expect(focus?.artists.map((a) => a.name)).toEqual(['Fleetwood Mac', 'Dire Straits']);
    const profile = analyzeSpotify({ artists: [{ name: 'Drake', genres: ['rap'] }], tracks: [], recent: [], playlists: [], focus }, new Date('2026-09-24T00:00:00Z'));
    expect(profile.topArtists.slice(0, 3)).toEqual(['Fleetwood Mac', 'Dire Straits', 'Drake']);
    expect(profile.genres[0]).toBe('soft rock');
    expect(profile.eras[0].decade).toBe('1970s');
    expect(profile.fromPlaylist).toBe('Road Trip Rock');
    expect(profile.playlistHints).toContain('Road trips');
  });

  it('counts artists across tracks', () => {
    expect(playlistArtists([{ artists: [{ name: 'A' }, { name: 'B' }] }, { artists: [{ name: 'b' }] }])).toEqual([
      { id: undefined, name: 'B', count: 2 },
      { id: undefined, name: 'A', count: 1 },
    ]);
  });
});
