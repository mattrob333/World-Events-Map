export type ProfileThemeVariant = 'midnight' | 'atlas' | 'alpine';
export type ProfileAccent = 'gold' | 'teal' | 'ember' | 'violet' | 'ice' | 'rose';
export type ProfileModule = 'travel_modes' | 'interests' | 'places' | 'links';

export interface PublicProfileLink {
  id: string;
  kind: 'instagram' | 'youtube' | 'website' | 'other';
  label: string;
  url: string;
}

export interface PublicProfilePlace {
  id: string;
  name: string;
  place_type: 'city' | 'venue' | 'resort' | 'region' | 'other';
  location_label: string;
  note: string;
}

export interface PublicProfileModeInterest {
  name: string;
  weight: number;
}

export interface PublicProfileTravelMode {
  id: string;
  name: string;
  description: string;
  party_type: string;
  destination: string;
  interests: PublicProfileModeInterest[];
}

export interface PublicTravelerProfile {
  id: string;
  handle: string;
  display_name: string;
  tagline: string;
  bio: string;
  avatar_url: string;
  hero_url: string;
  theme_variant: ProfileThemeVariant;
  theme_accent: ProfileAccent;
  module_order: ProfileModule[];
  home_city: string;
  home_airport: string;
  interests: string[];
  links: PublicProfileLink[];
  places: PublicProfilePlace[];
  travel_modes: PublicProfileTravelMode[];
}

export function isPublicTravelerProfile(value: unknown): value is PublicTravelerProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.id === 'string' &&
    typeof profile.handle === 'string' &&
    typeof profile.display_name === 'string' &&
    Array.isArray(profile.interests) &&
    Array.isArray(profile.links) &&
    Array.isArray(profile.places) &&
    Array.isArray(profile.travel_modes)
  );
}
