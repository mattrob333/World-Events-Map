import type { PartyType } from '@/lib/affinity';
import type { TravelContentProvider } from './content';

export type ProfileTheme = 'midnight' | 'alpine' | 'coastal' | 'desert' | 'city';
export type ProfileLinkKind = 'instagram' | 'youtube' | 'tiktok' | 'website' | 'other';
export type ProfilePlaceKind = 'visited' | 'favorite' | 'bucket';

export interface PublicTravelerProfile {
  handle: string;
  display_name: string;
  headline: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  profile_theme: ProfileTheme;
  home_city: string;
  home_airport: string;
  interests: string[];
  updated_at?: string;
}

export interface PublicProfileLink {
  id: string;
  kind: ProfileLinkKind;
  label: string;
  url: string;
}

export interface PublicProfilePlace {
  id: string;
  kind: ProfilePlaceKind;
  place_name: string;
  country_code: string;
  note: string;
  visited_on: string | null;
}

export interface PublicProfileContent {
  id: string;
  provider: TravelContentProvider;
  url: string;
  title: string;
  note: string;
  destination: string;
}

export interface PublicTravelMode {
  id: string;
  name: string;
  description: string;
  party_type: PartyType;
  origin_city: string;
  origin_airport: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  interests: { name: string; weight: number }[];
}

export interface TravelerSnapshot {
  profile: PublicTravelerProfile;
  links: PublicProfileLink[];
  places: PublicProfilePlace[];
  content: PublicProfileContent[];
  modes: PublicTravelMode[];
}

export interface TravelerProfileDraft {
  display_name: string;
  handle: string;
  headline: string;
  bio: string;
  avatar_url: string;
  cover_url: string;
  profile_theme: ProfileTheme;
  home_city: string;
  home_airport: string;
  interests: string[];
  is_public: boolean;
  show_home_base: boolean;
  show_travel_modes: boolean;
}
