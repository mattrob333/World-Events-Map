import type { PersonSummary } from '@/lib/inspiration/types';
import type { DestinationArchetype } from '@/lib/pulse/types';

export interface TravelerPortrait {
  person: PersonSummary;
  philosophy: string;
  featuredModes: string[];
  interests: string[];
  favoritePlaces: string[];
  relevantTo: string[];
  destinationIds: string[];
}

export const TRAVELER_FIXTURE_DISCLOSURE =
  'Editorial traveler portraits for layout and flow. These are not live members and cannot be messaged.';

export const TRAVELER_PORTRAITS: TravelerPortrait[] = [
  {
    person: {
      id: 'editorial-mara',
      handle: 'mara',
      displayName: 'Mara Ellison',
      avatarSeed: 'mara-ellison',
      homeLabel: 'Denver',
      source: 'editorial_fixture',
    },
    philosophy: 'Four mountains and a working town beat a purpose-built village.',
    featuredModes: ['Family ski', 'Quiet January'],
    interests: ['skiing', 'food', 'high alpine'],
    favoritePlaces: ['Aspen', 'Jackson Hole'],
    relevantTo: ['Ski weeks from the Rockies'],
    destinationIds: ['aspen|US'],
  },
  {
    person: {
      id: 'editorial-nico',
      handle: 'nico',
      displayName: 'Nico Varela',
      avatarSeed: 'nico-varela',
      homeLabel: 'Miami',
      source: 'editorial_fixture',
    },
    philosophy: 'Arrive before the circuit closes. Leave before the harbor empties.',
    featuredModes: ['Race weeks', 'Solo weekend'],
    interests: ['motorsport', 'sailing', 'nightlife'],
    favoritePlaces: ['Monte-Carlo', 'Miami'],
    relevantTo: ['Harbor and grid weeks'],
    destinationIds: ['monte-carlo|MC', 'aspen|US'],
  },
  {
    person: {
      id: 'editorial-jules',
      handle: 'jules',
      displayName: 'Jules Hartmann',
      avatarSeed: 'jules-hartmann',
      homeLabel: 'Zurich',
      source: 'editorial_fixture',
    },
    philosophy: 'The table is the itinerary. The mountain is the excuse.',
    featuredModes: ['Couples alpine', 'Food first'],
    interests: ['skiing', 'culinary', 'wine'],
    favoritePlaces: ['St. Moritz', 'Aspen', 'Courchevel'],
    relevantTo: ['Alpine dining weeks'],
    destinationIds: ['aspen|US', 'st. moritz|CH', 'courchevel|FR'],
  },
];

export function listTravelersForDestination(destinationId: string): TravelerPortrait[] {
  return TRAVELER_PORTRAITS.filter((portrait) =>
    portrait.destinationIds.includes(destinationId),
  );
}

export function getTraveler(handle: string): TravelerPortrait | undefined {
  return TRAVELER_PORTRAITS.find((portrait) => portrait.person.handle === handle);
}

export function archetypeOverlap(
  interests: string[],
  archetypes: DestinationArchetype[],
): string[] {
  const map: Record<string, DestinationArchetype> = {
    skiing: 'ski',
    food: 'food',
    culinary: 'food',
    motorsport: 'motorsport',
    sailing: 'sailing',
    nightlife: 'nightlife',
  };
  return interests.filter((interest) => archetypes.includes(map[interest]!));
}
