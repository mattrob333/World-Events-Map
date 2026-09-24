import { describe, expect, it } from 'vitest';
import { CARD_INDEX, CATALOG, DESTINATIONS } from '../catalog';
import { applyCuration, candidatesFor, composeLocally, daysUntil, groupTags, homeAirport, participantStyle, type Participant } from '../itinerary';
import { EXAMPLE_RAMBLE, bentoCards } from '../moodboard';
import { normalizeProfile, parseProfileLocally, profileTags } from '../profile';
import { InputError, validateComposeBody } from '../validate';
import { filterSlot, moveCard, orderSlot, tally } from '../votes';

const USER_EXAMPLE =
  "I'm a 44-year-old man from Atlanta, Georgia. The Atlanta Braves, I love hip hop and house music, concerts and festivals. Two young sons, 8 and 12. A wife. She's Brazilian.";

function family(): Participant[] {
  return [
    { id: 'p0', name: 'Matt', kind: 'adult', age: 44, tags: ['sports', 'music', 'food'], ...participantStyle(0) },
    { id: 'p1', name: 'Ana', kind: 'adult', tags: ['brazil', 'music'], ...participantStyle(1) },
    { id: 'p2', name: 'Leo', kind: 'kid', age: 12, tags: [], ...participantStyle(2) },
    { id: 'p3', name: 'Theo', kind: 'kid', age: 8, tags: [], ...participantStyle(3) },
  ];
}

describe('parseProfileLocally', () => {
  it('sorts the owner’s example ramble into stated facts only', () => {
    const profile = parseProfileLocally(USER_EXAMPLE);
    expect(profile.age).toBe(44);
    expect(profile.hometown).toBe('Atlanta, Georgia');
    expect(profile.teams).toEqual(['Atlanta Braves']);
    expect(profile.music).toEqual(expect.arrayContaining(['Hip Hop', 'House']));
    expect(profile.heritage).toEqual(['Brazil']);
    const kids = profile.family.filter((member) => member.relation === 'child');
    expect(kids.map((kid) => kid.age)).toEqual([8, 12]);
    expect(profile.family.find((member) => member.relation === 'partner')).toMatchObject({ label: 'Wife', note: 'Brazilian' });
  });

  it('does not invent a name or age that was not said', () => {
    const profile = parseProfileLocally('We love beaches and snorkeling with the kids.');
    expect(profile.age).toBeUndefined();
    expect(profile.name).toBeUndefined();
    expect(profile.interests).toEqual(expect.arrayContaining(['Beaches', 'Snorkeling']));
  });

  it('turns a profile into kid-aware planning tags', () => {
    const tags = profileTags(parseProfileLocally(EXAMPLE_RAMBLE));
    expect(tags).toEqual(expect.arrayContaining(['kids', 'little-kids', 'big-kids', 'sports', 'brazil', 'music', 'ski']));
  });

  it('normalizes untrusted profile JSON', () => {
    const profile = normalizeProfile({ age: 400, teams: ['A', 'A', 7], family: [{ relation: 'spouse', age: 'x' }], summary: 5 });
    expect(profile.age).toBeUndefined();
    expect(profile.teams).toEqual(['A']);
    expect(profile.family[0]).toMatchObject({ relation: 'other', age: undefined });
    expect(profile.summary).toBe('');
  });
});

describe('bentoCards', () => {
  it('groups the ramble into a few calm cards, home first', () => {
    const cards = bentoCards(parseProfileLocally(USER_EXAMPLE));
    expect(cards[0]).toMatchObject({ kind: 'home', title: 'Atlanta, Georgia', size: 'xl' });
    expect(cards.find((card) => card.kind === 'teams')).toMatchObject({ title: 'Atlanta Braves', palette: ['#13274F', '#CE1141'] });
    expect(cards.find((card) => card.kind === 'crew')?.items).toHaveLength(3);
    expect(cards.find((card) => card.kind === 'roots')).toMatchObject({ emoji: '🇧🇷' });
    expect(new Set(cards.map((card) => card.kind)).size).toBe(cards.length);
  });

  it('adds a Spotify vibe card and leads the sound card with the top artist', () => {
    const profile = { ...parseProfileLocally(USER_EXAMPLE), listening: { source: 'spotify' as const, importedAt: '2026-09-23T00:00:00Z', topArtists: ['Outkast', 'Gilberto Gil'], genres: ['hip hop', 'mpb'], eras: [{ decade: '1990s', share: 0.4 }], nightOwl: 0.3, energy: 'mixed' as const, roots: ['Brazil'], familyListening: false, playlistHints: [] } };
    const cards = bentoCards(profile);
    expect(cards.find((card) => card.kind === 'sound')).toMatchObject({ title: 'Outkast', eyebrow: 'On repeat · from Spotify' });
    expect(cards.find((card) => card.kind === 'vibe')?.meters?.[0]).toEqual({ label: 'After 10 pm', value: 0.3 });
  });
});

describe('catalog', () => {
  it('has unique ids and a local image path or none', () => {
    expect(new Set(CATALOG.map((card) => card.id)).size).toBe(CATALOG.length);
    for (const card of CATALOG) if (card.image) expect(card.image.startsWith('/editorial/')).toBe(true);
  });

  it('links only to search pages, never to a fabricated post', () => {
    for (const card of CATALOG) {
      if (!card.link) continue;
      expect(card.link.href).toMatch(/^https:\/\/(www\.youtube\.com\/results|www\.instagram\.com\/explore\/tags\/|www\.google\.com\/maps\/search\/)/);
    }
  });

  it('gives every destination options for every in-trip slot', () => {
    for (const destination of DESTINATIONS) {
      for (const slot of ['arrive', 'morning', 'lunch', 'afternoon', 'apres', 'dinner', 'late'] as const) {
        expect(candidatesFor(destination.id, slot, []).length, `${destination.id} ${slot}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('composeLocally', () => {
  const input = { destination: 'st-moritz' as const, startDate: '2027-02-06', nights: 7, hometown: 'Atlanta, Georgia', participants: family() };

  it('lays out a travel day, full middle days, and a travel-home day', () => {
    const trip = composeLocally(input, new Date('2026-09-23T00:00:00Z'));
    expect(trip.days).toHaveLength(8);
    expect(trip.days[0].slots.map((slot) => slot.kind)).toEqual(['depart', 'flight', 'arrive', 'dinner']);
    expect(trip.days[3].slots.map((slot) => slot.kind)).toEqual(['morning', 'lunch', 'afternoon', 'apres', 'dinner', 'late']);
    expect(trip.days[7].slots.map((slot) => slot.label)).toEqual(['Morning', 'Lunch', 'Head to the airport', 'Fly home']);
    expect(trip.days[7].date).toBe('2027-02-13');
    expect(trip.days[0].slots[1].note).toBe('ATL → ZRH. Route idea, not a fare.');
    expect(trip.engine).toBe('on-device');
  });

  it('only uses cards that exist and belong to the destination or travel days', () => {
    const trip = composeLocally(input);
    for (const slot of trip.days.flatMap((day) => day.slots)) {
      for (const id of slot.cardIds) {
        const card = CARD_INDEX.get(id)!;
        expect(card).toBeDefined();
        expect(['st-moritz', 'any']).toContain(card.destination);
        expect(card.slots).toContain(slot.kind);
      }
    }
  });

  it('varies the lead pick across the week and keeps nightclubs out of daytime for little kids', () => {
    const trip = composeLocally(input);
    const lunchLeads = trip.days.slice(1, 7).map((day) => day.slots.find((slot) => slot.kind === 'lunch')!.cardIds[0]);
    expect(new Set(lunchLeads).size).toBeGreaterThan(1);
    const afternoonLead = CARD_INDEX.get(trip.days[1].slots.find((slot) => slot.kind === 'afternoon')!.cardIds[0])!;
    expect(afternoonLead.tags).not.toContain('nightlife');
  });

  it('leans family-friendly when kids are going', () => {
    const tags = groupTags(family());
    const top = candidatesFor('aspen', 'morning', tags)[0];
    expect(top.tags).toContain('kids');
  });
});

describe('applyCuration', () => {
  it('reorders within the pool and drops invented or out-of-slot ids', () => {
    const base = composeLocally({ destination: 'aspen', startDate: '2027-01-09', nights: 3, participants: family() });
    const lunch = base.days[1].slots.find((slot) => slot.kind === 'lunch')!;
    const target = lunch.cardIds[lunch.cardIds.length - 1];
    const curated = applyCuration(
      base,
      {
        days: [
          {
            index: 1,
            title: '🍾 Champagne powder',
            hype: 'Big day.',
            slots: [{ id: lunch.id, cardIds: ['aspen:made-up-bar', 'st-moritz:kings-club', 'aspen:belly-up', target], note: 'Fits the group.' }],
          },
        ],
      },
      groupTags(base.participants),
    );
    const next = curated.days[1].slots.find((slot) => slot.id === lunch.id)!;
    expect(next.cardIds[0]).toBe(target);
    expect(next.cardIds).not.toContain('aspen:made-up-bar');
    expect(next.cardIds).not.toContain('st-moritz:kings-club');
    expect(next.cardIds).not.toContain('aspen:belly-up');
    expect(new Set(next.cardIds)).toEqual(new Set(lunch.cardIds));
    expect(curated.days[1].title).toBe('🍾 Champagne powder');
    expect(curated.engine).toBe('claude');
  });
});

describe('votes', () => {
  it('tallies, sorts stably by group score, and filters', () => {
    const votes = { a: { p0: -1 as const }, b: { p0: 1 as const, p1: 1 as const }, c: {} };
    expect(tally(votes.b)).toEqual({ up: 2, down: 0, score: 2 });
    expect(orderSlot(['a', 'b', 'c'], votes, 'group')).toEqual(['b', 'c', 'a']);
    expect(orderSlot(['a', 'b', 'c'], votes, 'curated')).toEqual(['a', 'b', 'c']);
    expect(filterSlot(['a', 'b', 'c'], votes, 'loved')).toEqual(['b']);
    expect(filterSlot(['a', 'b', 'c'], votes, 'unvoted', 'p1')).toEqual(['a', 'c']);
  });

  it('moves cards between slots without mutating input', () => {
    const slots = { x: ['a', 'b'], y: ['c'] };
    const next = moveCard(slots, 'a', 'x', 'y', 1);
    expect(next).toEqual({ x: ['b'], y: ['c', 'a'] });
    expect(slots).toEqual({ x: ['a', 'b'], y: ['c'] });
    expect(moveCard(slots, 'zzz', 'x', 'y')).toBe(slots);
  });
});

describe('validateComposeBody', () => {
  const body = { destination: 'maldives', startDate: '2027-07-01', nights: 5, participants: [{ name: 'Ana', kind: 'adult', tags: ['water', 'DROP TABLE'] }] };

  it('accepts a well-formed request and strips bad tags', () => {
    const { input } = validateComposeBody(body);
    expect(input.participants[0].tags).toEqual(['water']);
  });

  it.each([
    [{ ...body, destination: 'atlantis' }, 'Choose a destination'],
    [{ ...body, startDate: '2027-02-30' }, 'valid start date'],
    [{ ...body, nights: 40 }, '1 to 14 nights'],
    [{ ...body, participants: [] }, 'at least one traveler'],
  ])('rejects %#', (bad, message) => {
    expect(() => validateComposeBody(bad)).toThrow(InputError);
    expect(() => validateComposeBody(bad)).toThrow(message);
  });
});

describe('helpers', () => {
  it('maps hometowns to airports and counts days', () => {
    expect(homeAirport('Atlanta, Georgia')).toBe('ATL');
    expect(homeAirport('Tiny Town')).toBeUndefined();
    expect(daysUntil('2026-10-03', new Date(2026, 8, 23))).toBe(10);
  });
});

describe('moodboard imagery', () => {
  it('never repeats the same photo on one board', () => {
    const images = bentoCards(parseProfileLocally(EXAMPLE_RAMBLE)).map((card) => card.image).filter(Boolean);
    expect(new Set(images).size).toBe(images.length);
  });
});

describe('family nationality', () => {
  it('treats "my wife is Brazilian" as a note, not a name', () => {
    const profile = parseProfileLocally('My wife is Brazilian and we have two kids.');
    const wife = profile.family.find((member) => member.relation === 'partner');
    expect(wife).toMatchObject({ label: 'Wife', note: 'Brazilian' });
    expect(wife?.name).toBeUndefined();
    expect(profile.heritage).toContain('Brazil');
  });
});
