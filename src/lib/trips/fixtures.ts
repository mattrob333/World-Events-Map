export interface TripRoomFixture {
  id: string;
  name: string;
  destinationId: string;
  destinationSlug: string;
  destinationLabel: string;
  travelMode: string;
  start: string;
  end: string;
  status: 'forming' | 'planning' | 'soon' | 'there';
  nextDecision: string;
  memberHandles: string[];
}

export const TRIP_ROOM_DISCLOSURE =
  'Sample trip room — fixture data for the product preview. Not a live Circle and not a confirmed itinerary.';

export const TRIP_ROOM_FIXTURES: TripRoomFixture[] = [
  {
    id: 'aspen-holiday',
    name: 'Aspen, if the snow holds',
    destinationId: 'aspen|US',
    destinationSlug: 'aspen',
    destinationLabel: 'Aspen',
    travelMode: 'Family ski',
    start: '2026-12-19',
    end: '2027-01-03',
    status: 'planning',
    nextDecision: 'Lock the mountain week or slip to mid-January.',
    memberHandles: ['mara', 'jules', 'nico'],
  },
  {
    id: 'monaco-harbor',
    name: 'Harbor week',
    destinationId: 'monte-carlo|MC',
    destinationSlug: 'monte-carlo',
    destinationLabel: 'Monte-Carlo',
    travelMode: 'Race weeks',
    start: '2027-05-20',
    end: '2027-05-24',
    status: 'forming',
    nextDecision: 'Who is actually coming before rooms disappear.',
    memberHandles: ['nico', 'jules'],
  },
];

export function getTripRoom(id: string): TripRoomFixture | undefined {
  return TRIP_ROOM_FIXTURES.find((trip) => trip.id === id);
}

export function listTripRoomsForDestination(destinationId: string): TripRoomFixture[] {
  return TRIP_ROOM_FIXTURES.filter((trip) => trip.destinationId === destinationId);
}

export function listTripRoomsForSlug(slug: string): TripRoomFixture[] {
  const needle = slug.trim().toLowerCase();
  if (!needle) return [];
  return TRIP_ROOM_FIXTURES.filter((trip) => trip.destinationSlug === needle);
}
