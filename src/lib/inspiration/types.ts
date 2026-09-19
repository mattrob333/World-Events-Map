export type InspirationKind =
  | 'place'
  | 'restaurant'
  | 'bar'
  | 'nightlife'
  | 'stay'
  | 'video'
  | 'article'
  | 'event'
  | 'experience'
  | 'note';

export interface PersonSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarSeed: string;
  homeLabel?: string;
  /** Editorial portraits are never presented as live members. */
  source: 'editorial_fixture' | 'signed_in_member';
}

export interface InspirationVotes {
  mustDo: number;
  maybe: number;
  skip: number;
}

export type InspirationVote = 'mustDo' | 'maybe' | 'skip';

export interface InspirationItem {
  id: string;
  kind: InspirationKind;
  title: string;
  subtitle?: string;
  canonicalUrl?: string;
  imageLabel?: string;
  sourceLabel?: string;
  savedBy: PersonSummary;
  votes: InspirationVotes;
  category: string;
  destinationId: string;
  createdAt: string;
  note?: string;
}

export const INSPIRATION_KIND_LABEL: Record<InspirationKind, string> = {
  place: 'Place',
  restaurant: 'Restaurant',
  bar: 'Bar',
  nightlife: 'Nightlife',
  stay: 'Stay',
  video: 'Video',
  article: 'Article',
  event: 'Event',
  experience: 'Experience',
  note: 'Note',
};
