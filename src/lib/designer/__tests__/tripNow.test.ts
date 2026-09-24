import { describe, expect, it } from 'vitest';
import { cardLookup, composeLocally, participantStyle, tripHop, type Itinerary, type Participant } from '../itinerary';
import { placeCards } from '../place';
import { isLive, mapsNearYou, slotForTime, slotKindNow, tripMoment, type LiveMoment } from '../tripNow';

const couple: Participant[] = [
  { id: 'p0', name: 'Matt', kind: 'adult', tags: ['music', 'nightlife'], ...participantStyle(0) },
  { id: 'p1', name: 'Sam', kind: 'adult', tags: [], ...participantStyle(1) },
];

/** Lisbon from New York, Wed 23 Sep → Mon 28 Sep 2026 (6 days, 5 nights). */
function lisbon(): Itinerary {
  return composeLocally(
    { destination: 'custom', place: { name: 'Lisbon', region: 'Portugal', kind: 'city' }, startDate: '2026-09-23', nights: 5, hometown: 'New York', participants: couple },
    new Date('2026-09-01T12:00:00Z'),
  );
}

function live(trip: Itinerary, when: Date): LiveMoment {
  const moment = tripMoment(trip, when);
  if (!isLive(moment)) throw new Error(`expected a live moment, got ${moment.phase}`);
  return moment;
}

describe('tripMoment phases', () => {
  const trip = lisbon();

  it('is "before" until the first day, with the days left', () => {
    expect(tripMoment(trip, new Date(2026, 8, 22, 20, 0))).toEqual({ phase: 'before', daysUntil: 1 });
  });

  it('day 0 before arrival is a travel day: the flight now, the arrival up next', () => {
    const moment = live(trip, new Date(2026, 8, 23, 10, 0));
    expect(moment.phase).toBe('travel-out');
    expect(moment.day.index).toBe(0);
    expect(moment.current?.kind).toBe('flight');
    expect(moment.next?.kind).toBe('arrive');
    expect(moment.next?.note).toBeTruthy();
  });

  it('day 0 after arrival is on the ground', () => {
    const moment = live(trip, new Date(2026, 8, 23, 20, 0));
    expect(moment.phase).toBe('on-ground');
    expect(moment.current?.kind).toBe('dinner');
  });

  it('switches at the times the slots show (I10)', () => {
    const morning = live(trip, new Date(2026, 8, 24, 12, 15));
    expect(morning.current?.kind).toBe('morning');
    expect(morning.next?.kind).toBe('lunch');
    expect(morning.until).toBe('12:30');
    expect(live(trip, new Date(2026, 8, 24, 12, 30)).current?.kind).toBe('lunch');
    const early = live(trip, new Date(2026, 8, 24, 8, 30));
    expect(early.current).toBeUndefined();
    expect(early.next?.kind).toBe('morning');
    expect(live(trip, new Date(2026, 8, 24, 22, 0)).current?.kind).toBe('dinner');
    expect(live(trip, new Date(2026, 8, 24, 22, 30)).current?.kind).toBe('late');
  });

  it('01:30 is still the previous day’s late night (I07)', () => {
    const moment = live(trip, new Date(2026, 8, 25, 1, 30));
    expect(moment.day.index).toBe(1);
    expect(moment.current?.kind).toBe('late');
    expect(moment.tonight).toBe(true);
  });

  it('the last day: lunch, then the airport, then the flight home (I01)', () => {
    const lunch = live(trip, new Date(2026, 8, 28, 13, 0));
    expect(lunch.phase).toBe('on-ground');
    expect(lunch.current?.kind).toBe('lunch');
    expect(lunch.next?.kind).toBe('depart');
    const transfer = live(trip, new Date(2026, 8, 28, 15, 30));
    expect(transfer.phase).toBe('travel-home');
    expect(transfer.current?.label).toBe('Head to the airport');
    expect(transfer.next?.label).toBe('Fly home');
    const flight = live(trip, new Date(2026, 8, 28, 21, 0));
    expect(flight.phase).toBe('travel-home');
    expect(flight.current?.label).toBe('Fly home');
    expect(flight.next).toBeUndefined();
  });

  it('labels the return transfer "Afternoon", not "Early"', () => {
    const depart = trip.days[5].slots.find((slot) => slot.kind === 'depart')!;
    expect(depart.time).toBe('Afternoon');
    expect(trip.days[0].slots.find((slot) => slot.kind === 'depart')!.time).toBe('Early');
  });

  it('is "after" the day after the trip, with how long ago (I05)', () => {
    expect(tripMoment(trip, new Date(2026, 8, 29, 10, 0))).toEqual({ phase: 'after', daysAgo: 1 });
    expect(tripMoment(trip, new Date(2026, 9, 3, 10, 0))).toEqual({ phase: 'after', daysAgo: 5 });
  });

  it('uses a slot’s own time when it has one', () => {
    const custom = lisbon();
    custom.days[5].slots.find((slot) => slot.kind === 'depart')!.time = '17:00';
    expect(live(custom, new Date(2026, 8, 28, 15, 30)).phase).toBe('on-ground');
    expect(live(custom, new Date(2026, 8, 28, 17, 5)).phase).toBe('travel-home');
    const lunchLater = lisbon();
    lunchLater.days[1].slots.find((slot) => slot.kind === 'lunch')!.time = '13:30';
    expect(live(lunchLater, new Date(2026, 8, 24, 13, 0)).current?.kind).toBe('morning');
  });
});

describe('one clock table for NOW', () => {
  it('matches the slot times the canvas shows, without Après off the slopes', () => {
    expect(slotForTime(new Date(2027, 0, 1, 11, 45))).toBe('morning');
    expect(slotForTime(new Date(2027, 0, 1, 12, 30))).toBe('lunch');
    expect(slotForTime(new Date(2027, 0, 1, 18, 45))).toBe('afternoon');
    expect(slotForTime(new Date(2027, 0, 1, 18, 45), 'ski')).toBe('apres');
    expect(slotForTime(new Date(2027, 0, 1, 22, 45))).toBe('late');
    expect(slotForTime(new Date(2027, 0, 1, 1, 30))).toBe('late');
  });

  it('follows the live trip when there is one', () => {
    const trip = lisbon();
    const at = new Date(2026, 8, 24, 12, 15);
    expect(slotKindNow(tripMoment(trip, at), at)).toBe('morning');
    expect(slotKindNow(null, at)).toBe('morning');
  });
});

describe('Maps searches near you (I06)', () => {
  it('drops the city and region so Maps searches around the phone', () => {
    const link = mapsNearYou('https://www.google.com/maps/search/?api=1&query=best%20local%20lunch%20Lisbon%20Portugal', { name: 'Lisbon', region: 'Portugal' });
    expect(link?.label).toBe('Maps search near you');
    expect(decodeURIComponent(link!.href.split('query=')[1])).toBe('best local lunch');
  });

  it('leaves other links alone', () => {
    expect(mapsNearYou('https://www.youtube.com/results?search_query=Lisbon', { name: 'Lisbon' })).toBeUndefined();
  });
});

describe('trip shape fits the trip (F13)', () => {
  const family: Participant[] = [
    { id: 'p0', name: 'Dana', kind: 'adult', tags: ['music', 'food'], ...participantStyle(0) },
    { id: 'p1', name: 'Chris', kind: 'adult', tags: [], ...participantStyle(1) },
    { id: 'p2', name: 'Ava', kind: 'kid', age: 8, tags: [], ...participantStyle(2) },
    { id: 'p3', name: 'Leo', kind: 'kid', age: 12, tags: [], ...participantStyle(3) },
  ];
  const nashville = composeLocally({ destination: 'custom', place: { name: 'Nashville', region: 'Tennessee', kind: 'city' }, startDate: '2027-03-12', nights: 3, hometown: 'Atlanta, Georgia', participants: family });
  const lookup = cardLookup(nashville);

  it('city trips have no Après slot; ski trips keep it', () => {
    expect(nashville.days.flatMap((day) => day.slots).some((slot) => slot.kind === 'apres')).toBe(false);
    const ski = composeLocally({ destination: 'aspen', startDate: '2027-01-10', nights: 3, participants: family });
    expect(ski.days[1].slots.some((slot) => slot.kind === 'apres')).toBe(true);
  });

  it('a short hop gets no overnight flight or lounge, and offers the drive', () => {
    expect(tripHop({ destination: 'custom', place: { name: 'Nashville', region: 'Tennessee', kind: 'city' }, hometown: 'Atlanta, Georgia' }).hop).toBe('drive');
    const ids = nashville.days.flatMap((day) => day.slots).flatMap((slot) => slot.cardIds);
    expect(ids).not.toContain('any:overnight-flight');
    expect(ids).not.toContain('any:lounge');
    expect(nashville.days[0].slots.find((slot) => slot.kind === 'flight')!.cardIds[0]).toBe('any:drive');
  });

  it('a long haul keeps the overnight flight and has no drive card', () => {
    const ids = lisbon().days[0].slots.flatMap((slot) => slot.cardIds);
    expect(ids).toContain('any:overnight-flight');
    expect(ids).not.toContain('any:drive');
  });

  it('a family’s late-night pick is never plain cocktails when something family-friendly fits', () => {
    for (const day of nashville.days) {
      const late = day.slots.find((slot) => slot.kind === 'late');
      if (late) expect(lookup(late.cardIds[0])?.title).not.toMatch(/Cocktails/);
    }
  });
});

describe('live-music copy without listings (I03)', () => {
  it('the idea card does not promise tonight', () => {
    const titles = placeCards({ name: 'Lisbon', kind: 'city' }, { tags: [] }).map((card) => card.title);
    expect(titles).toContain('Find a live-music bar in Lisbon');
    expect(titles.join(' ')).not.toMatch(/tonight/i);
  });
});
