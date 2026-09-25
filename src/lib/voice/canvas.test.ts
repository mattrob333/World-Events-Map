import { describe, expect, it } from 'vitest';
import { pinPicks } from '@/lib/designer/vibePicks';
import { composeLocally } from '@/lib/designer/itinerary';
import { EMPTY_CANVAS, pickedSpotsIn, sourceHost, togglePick, tripPlace, withFocus, withPlaces, withSpots } from './canvas';

const ranked = [
  { key: 'resort:switzerland:st-moritz', name: 'St. Moritz', country: 'Switzerland', events: [{ id: 'white-turf' }], reasons: [{ text: 'White Turf overlaps your dates' }] },
  { key: 'resort:switzerland:zermatt', name: 'Zermatt', country: 'Switzerland' },
];

describe('Vibe canvas', () => {
  it('only accepts spots with an https source, and never our own site', () => {
    expect(sourceHost('https://www.theinfatuation.com/x')).toBe('theinfatuation.com');
    expect(sourceHost('http://example.com')).toBeNull();
    expect(sourceHost('https://user:pw@example.com')).toBeNull();
    expect(sourceHost('https://dope.travel/x')).toBeNull();
    expect(sourceHost('javascript:alert(1)')).toBeNull();
    const result = withSpots(EMPTY_CANVAS, 'Zermatt', [
      { name: 'Chez Vrony', kind: 'eat', why: 'Mountain hut lunch under the Matterhorn', url: 'https://www.chezvrony.ch' },
      { name: 'Made Up Club', kind: 'dance', why: 'x', url: 'not a url' },
      { name: 'Chez Vrony', kind: 'eat', why: 'dup', url: 'https://example.com' },
      { name: 'Hennu Stall', kind: 'weird', why: 'x', url: 'https://example.com' },
    ]);
    expect(result.added).toBe(1);
    expect(result.rejected).toBe(2);
    expect(result.canvas.spots[0]).toMatchObject({ name: 'Chez Vrony', host: 'chezvrony.ch', place: 'Zermatt' });
    // The town they found spots in lands on the canvas too.
    expect(result.canvas.places.map((place) => place.name)).toEqual(['Zermatt']);
  });

  it('ranks places, keeps best-fit marks across re-ranks, and ignores unknown names', () => {
    let canvas = withPlaces(EMPTY_CANVAS, ranked, [{ key: 'resort:austria:lech', name: 'Lech', country: 'Austria' }]);
    expect(canvas.places.map((place) => place.name)).toEqual(['St. Moritz', 'Zermatt', 'Lech']);
    expect(canvas.places[2]!.quiet).toBe(true);
    const focused = withFocus(canvas, ['Zermatt', 'Atlantis'], 'Your late-night crowd');
    expect(focused.marked).toEqual(['Zermatt']);
    // In range but not shown: a best-fit mark brings it forward.
    const hidden = withPlaces(EMPTY_CANVAS, [], [{ key: 'resort:austria:lech', name: 'Lech', country: 'Austria' }].concat(Array.from({ length: 20 }, (_, i) => ({ key: `resort:x:r${i}`, name: `Resort ${i}`, country: 'X' }))).concat([{ key: 'resort:switzerland:zermatt', name: 'Zermatt', country: 'Switzerland' }]));
    expect(hidden.places.some((place) => place.name === 'Zermatt')).toBe(false);
    expect(withFocus(hidden, ['Zermatt'], 'Late nights').canvas.places[0]).toMatchObject({ name: 'Zermatt', focus: 'Late nights' });
    canvas = withPlaces(focused.canvas, ranked);
    expect(canvas.places.find((place) => place.name === 'Zermatt')!.focus).toBe('Your late-night crowd');
  });

  it('builds the trip where most picks are, and pins picks into matching time blocks', () => {
    let canvas = withPlaces(EMPTY_CANVAS, ranked);
    canvas = withSpots(canvas, 'Zermatt', [
      { name: 'Chez Vrony', kind: 'eat', why: 'Hut lunch', url: 'https://www.chezvrony.ch' },
      { name: 'Hennu Stall', kind: 'apres', why: 'Après on the piste', url: 'https://example.com/hennu' },
    ]).canvas;
    for (const spot of canvas.spots) canvas = togglePick(canvas, spot.id);
    expect(tripPlace(canvas)?.name).toBe('Zermatt');
    const picks = pickedSpotsIn(canvas, 'Zermatt');
    const trip = composeLocally({ destination: 'custom', place: { name: 'Zermatt', region: 'Switzerland', kind: 'ski' } as never, startDate: '2027-02-01', nights: 4, participants: [{ id: 'p0', name: 'Matt', kind: 'adult', tags: [], color: '#000', emoji: '😎' }] });
    const pinned = pinPicks(trip, picks);
    const leads = pinned.days.flatMap((day) => day.slots.map((slot) => ({ kind: slot.kind, lead: slot.cardIds[0] })));
    expect(leads.find((entry) => entry.lead?.includes('chez-vrony'))?.kind).toBe('dinner');
    expect(leads.find((entry) => entry.lead?.includes('hennu-stall'))?.kind).toBe('apres');
    expect(pinned.cards?.some((card) => card.link?.href === 'https://www.chezvrony.ch')).toBe(true);
  });
});
