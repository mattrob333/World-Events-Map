import { describe, expect, it } from 'vitest';
import { composeLocally } from '@/lib/designer/itinerary';
import type { Beacon } from '@/lib/types';
import { ACTIVITIES, type Activity } from '../activities';
import { dedupeBeacons, heatKey, sameEventName, withHeat } from '../dedupe';
import { activityCard, inTrip, pinActivity, spotTripHref, unpinActivity } from '../trip';
import { validateActivities } from '../validate';

const beacon = (eventId: string, lat: number, lon: number, score = 88): Beacon => ({
  eventId, coords: { lat, lon }, score, heat: 'hot' as Beacon['heat'], category: 'festival' as Beacon['category'],
  label: eventId, city: 'x', relevance: 1, daysUntil: 10, focused: false, peerCount: 0,
});

const festival: Activity = {
  ...ACTIVITIES.find((a) => a.kind === 'event' && a.eventDates)!,
  id: 'test-fest-us', name: 'Test Fest', lat: 30, lng: -97,
  eventDates: { start: '2027-03-10', end: '2027-03-14', status: 'confirmed', sourceUrl: 'https://example.org' },
};

describe('dedupeBeacons', () => {
  it('drops a beacon for the same event nearby and passes its heat on', () => {
    const events = new Map([
      ['a', { id: 'a', name: 'Test Fest', start: '2027-03-12', end: '2027-03-13' }],
      ['b', { id: 'b', name: 'Far away', start: '2027-03-12', end: '2027-03-13' }],
    ]);
    const out = dedupeBeacons([beacon('a', 30.1, -97.1, 91), beacon('b', 40, -74)], events, [festival]);
    expect(out.beacons.map((b) => b.eventId)).toEqual(['b']);
    expect(out.heat.get('test-fest-us')).toBe(91);
    expect(withHeat([festival], heatKey(out.heat))[0].heat).toBe(91);
  });

  it('keeps a different event even when it is nearby on overlapping dates', () => {
    const events = new Map([['v', { id: 'v', name: 'Verbier Festival', start: '2027-03-12', end: '2027-03-13' }]]);
    const out = dedupeBeacons([beacon('v', 30.2, -97.2)], events, [{ ...festival, name: 'Montreux Jazz Festival' }]);
    expect(out.beacons).toHaveLength(1);
    expect(out.heat.size).toBe(0);
  });

  it('matches the same name but not across the world', () => {
    const events = new Map([
      ['near', { id: 'near', name: 'The Test Fest', start: '2027-06-01', end: '2027-06-02' }],
      ['far', { id: 'far', name: 'Test Fest', start: '2027-03-12', end: '2027-03-13' }],
    ]);
    const out = dedupeBeacons([beacon('near', 31, -97), beacon('far', 51, 0)], events, [festival]);
    expect(out.beacons.map((b) => b.eventId)).toEqual(['far']);
  });

  it('keeps everything and returns the same activities when nothing matches', () => {
    const out = dedupeBeacons([beacon('z', 0, 0)], new Map(), ACTIVITIES);
    expect(out.beacons).toHaveLength(1);
    expect(withHeat(ACTIVITIES, heatKey(out.heat))).toBe(ACTIVITIES);
  });
});

describe('sameEventName', () => {
  it('matches names of the same event and not their neighbors', () => {
    expect(sameEventName('Bahrain Grand Prix', 'Bahrain GP')).toBe(true);
    expect(sameEventName('Oktoberfest', 'oktoberfest')).toBe(true);
    expect(sameEventName('Sapporo Snow Festival', 'Sapporo Snow Festival 2027')).toBe(true);
    expect(sameEventName('Verbier Festival', 'Montreux Jazz Festival')).toBe(false);
    expect(sameEventName('Sydney to Hobart Yacht Race', "Sydney New Year's Eve")).toBe(false);
    expect(sameEventName('Noma', 'Christmas in Tivoli')).toBe(false);
    expect(sameEventName('Monaco Grand Prix', 'Monaco Yacht Show')).toBe(false);
  });
});

describe('spots in a trip', () => {
  const trip = composeLocally(
    {
      destination: 'custom',
      place: { name: 'Austin', region: 'Texas', kind: 'city' },
      startDate: '2027-03-11',
      nights: 3,
      participants: [],
      foods: [],
    },
    new Date('2026-09-24T12:00:00Z'),
  );

  it('adds the spot once, on its event dates, and takes it back out', () => {
    const pinned = pinActivity(trip, festival);
    expect(inTrip(pinned, festival)).toBe(true);
    expect(pinActivity(pinned, festival)).toBe(pinned);
    const id = activityCard(festival).id;
    const days = pinned.days.filter((d) => d.slots.some((s) => s.cardIds.includes(id)));
    expect(days).toHaveLength(1);
    expect(days[0].date >= '2027-03-10' && days[0].date <= '2027-03-14').toBe(true);
    const removed = unpinActivity(pinned, festival);
    expect(inTrip(removed, festival)).toBe(false);
    expect(removed.days.flatMap((d) => d.slots).some((s) => s.cardIds.includes(id))).toBe(false);
  });
});

describe('validateActivities', () => {
  it('flags the mistakes the dataset has had', () => {
    const bad = [
      { ...festival, id: 'dup-us' },
      { ...festival, id: 'dup-us', summary: 'x'.repeat(91), lat: 120 },
      { ...festival, id: 'no-dates-us', eventDates: null },
      { ...festival, id: 'wrong-code-fr', links: { officialSite: 'http://insecure.example' }, hashtags: ['#nope'], nearestAirports: [{ iata: 'aus' }] },
    ] as Activity[];
    const { errors } = validateActivities(bad);
    const text = errors.join('\n');
    expect(text).toMatch(/duplicate id/);
    expect(text).toMatch(/summary is 91/);
    expect(text).toMatch(/coordinates out of range/);
    expect(text).toMatch(/events need dates/);
    expect(text).toMatch(/id suffix/);
    expect(text).toMatch(/links\.officialSite/);
    expect(text).toMatch(/hashtag/);
    expect(text).toMatch(/airport code/);
  });
});

describe('spotTripHref', () => {
  it('sends a spot to the designer with its place and dates', () => {
    const href = spotTripHref('aspen-snowmass-us', '1', new Date(2026, 8, 27));
    const url = new URL(href!, 'https://x.test');
    expect(url.pathname).toBe('/trips/designer');
    expect(url.searchParams.get('place')).toBe(ACTIVITIES.find((a) => a.id === 'aspen-snowmass-us')!.place);
    expect(url.searchParams.get('start')).toMatch(/^2027-01-/);
    expect(url.searchParams.get('nights')).toBe('7');
  });

  it('is null for an unknown spot', () => {
    expect(spotTripHref('nope-xx', '1', new Date())).toBeNull();
  });
});
