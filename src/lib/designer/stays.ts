/**
 * Where you'll stay: search links sized to the party. These open the real
 * search on each site with dates and guests filled in. They are not
 * listings and carry no prices, so the UI must never present them as either.
 */

import { withAffiliate } from '@/lib/booking/partners';

export type StayParty = { adults: number; kids: number; kidAges: number[] };

export type StaySearch = {
  id: 'airbnb' | 'vrbo' | 'booking' | 'hostelworld';
  label: string;
  href: string;
  note: string;
};

export const DEFAULT_KID_AGE = 8;

export function partyFrom(participants: { kind: 'adult' | 'kid'; age?: number }[]): StayParty {
  const kids = participants.filter((p) => p.kind === 'kid');
  return {
    adults: Math.max(1, participants.length - kids.length),
    kids: kids.length,
    kidAges: kids.map((kid) => Math.min(17, Math.max(0, kid.age ?? DEFAULT_KID_AGE))),
  };
}

/** Rough bedroom count: adults pair up, kids share two to a room. */
export function bedroomsFor(party: StayParty): number {
  return Math.max(1, Math.ceil(party.adults / 2) + Math.ceil(party.kids / 2));
}

function addNights(iso: string, nights: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + nights);
  return date.toISOString().slice(0, 10);
}

export function staySearches(input: { place: string; checkIn: string; nights: number; party: StayParty; lodging?: string[] }): StaySearch[] {
  const { place, checkIn, nights, party } = input;
  const checkOut = addNights(checkIn, nights);
  const bedrooms = bedroomsFor(party);
  const guests = party.adults + party.kids;
  const where = encodeURIComponent(place);

  const airbnb = new URLSearchParams({ checkin: checkIn, checkout: checkOut, adults: String(party.adults) });
  if (party.kids) airbnb.set('children', String(party.kids));
  if (bedrooms > 1) airbnb.set('min_bedrooms', String(bedrooms));

  const vrbo = new URLSearchParams({ destination: place, startDate: checkIn, endDate: checkOut, adults: String(party.adults) });
  if (party.kids) vrbo.set('children', party.kidAges.map((age) => `1_${age}`).join(','));
  if (bedrooms > 1) vrbo.set('minBedrooms', String(bedrooms));

  const booking = new URLSearchParams({
    ss: place, checkin: checkIn, checkout: checkOut,
    group_adults: String(party.adults), group_children: String(party.kids), no_rooms: String(Math.max(1, Math.ceil(guests / 4))),
  });
  for (const age of party.kidAges) booking.append('age', String(age));

  const searches: StaySearch[] = [
    { id: 'airbnb', label: 'Airbnb', href: `https://www.airbnb.com/s/${where}/homes?${airbnb}`, note: bedrooms > 1 ? `Homes with ${bedrooms}+ bedrooms` : 'Homes and apartments' },
    { id: 'vrbo', label: 'Vrbo', href: withAffiliate('vrbo', `https://www.vrbo.com/search?${vrbo}`), note: 'Whole houses for the crew' },
    { id: 'booking', label: 'Booking.com', href: withAffiliate('booking', `https://www.booking.com/searchresults.html?${booking}`), note: 'Hotels, free cancellation filters' },
  ];
  const wantsHostel = (input.lodging ?? []).some((entry) => /hostel/i.test(entry));
  if (wantsHostel && !party.kids) {
    searches.push({
      id: 'hostelworld',
      label: 'Hostelworld',
      href: `https://www.hostelworld.com/search?search_keywords=${where}&date_from=${checkIn}&date_to=${checkOut}&number_of_guests=${guests}`,
      note: 'Social hostels with a bar',
    });
  }
  return searches;
}
