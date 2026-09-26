/**
 * The tools people who travel well actually use. Real services only, what
 * each is for in a line, no prices and no affiliate links.
 */
export type Tool = { name: string; url: string; what: string; lane: 'deals' | 'points' | 'lounges' | 'hostels' };

export const TOOLKIT: readonly Tool[] = [
  { name: 'Google Flights', url: 'https://www.google.com/travel/flights', what: 'Track a route and get told when the fare drops', lane: 'deals' },
  { name: 'Skyscanner', url: 'https://www.skyscanner.com', what: 'Search “Everywhere” to see where’s cheap from home', lane: 'deals' },
  { name: 'Going', url: 'https://www.going.com', what: 'Cheap-fare alerts from your home airports', lane: 'deals' },
  { name: 'Secret Flying', url: 'https://www.secretflying.com', what: 'Error fares and flash sales, worldwide', lane: 'deals' },
  { name: 'seats.aero', url: 'https://seats.aero', what: 'Find award seats you can book with points', lane: 'points' },
  { name: 'point.me', url: 'https://www.point.me', what: 'Which of your points gets you there, and how', lane: 'points' },
  { name: 'Priority Pass', url: 'https://www.prioritypass.com', what: 'Lounge access, often free with a travel card', lane: 'lounges' },
  { name: 'Hostelworld', url: 'https://www.hostelworld.com', what: 'Hostels with real reviews, private rooms included', lane: 'hostels' },
];
