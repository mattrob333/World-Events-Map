export const ONBOARDING_STEPS = [
  'traveler',
  'home',
  'interests',
  'mode',
  'visibility',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const TRAVELER_KINDS = [
  'family',
  'couple',
  'solo',
  'work',
  'friends',
] as const;

export type TravelerKind = (typeof TRAVELER_KINDS)[number];

export interface OnboardingDraft {
  travelerKind: TravelerKind | null;
  homeRegion: string;
  homeAirport: string;
  interests: string[];
  modeName: string;
  visibility: 'private' | 'discoverable';
  completed: boolean;
  skipped: boolean;
}

export const EMPTY_ONBOARDING: OnboardingDraft = {
  travelerKind: null,
  homeRegion: '',
  homeAirport: '',
  interests: [],
  modeName: '',
  visibility: 'private',
  completed: false,
  skipped: false,
};

export const INTEREST_OPTIONS = [
  'skiing',
  'sailing',
  'motorsport',
  'food',
  'art',
  'music',
  'wellness',
  'nature',
  'film',
  'nightlife',
] as const;

export const TRAVELER_KIND_COPY: Record<TravelerKind, { title: string; body: string }> = {
  family: { title: 'Family', body: 'School calendars, beds that actually sleep, and a mountain that works for mixed ages.' },
  couple: { title: 'Couple', body: 'One shared week. Tables, rooms, and a pace that does not require a committee.' },
  solo: { title: 'Solo', body: 'Open to the right room of people. Not a mixer. Not a tour.' },
  work: { title: 'Work layover', body: 'A few honest hours in a city you did not choose.' },
  friends: { title: 'Friends', body: 'A group chat that finally becomes a date and a destination.' },
};
