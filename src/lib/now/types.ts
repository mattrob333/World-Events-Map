import type { CandidateJudgment, GeoPoint, VenueCandidate } from '@/lib/opportunities';

export type NowIntent = 'food' | 'drinks' | 'music' | 'experience' | 'surprise';
export type NowVibe = 'chill' | 'social' | 'lively' | 'surprise';
export type NowPickLabel = 'best_match' | 'most_alive' | 'wildcard';

export interface NowRequest {
  location: GeoPoint;
  intent: NowIntent;
  vibe: NowVibe;
  radiusMeters: number;
  availableMinutes?: number;
  maxPriceLevel?: number;
  minRating?: number;
  partySize?: number;
  interests?: string[];
  travelModeName?: string;
}

export interface NowDimensionScores {
  intent: number;
  energy: number;
  quality: number;
  distance: number;
  socialProof: number;
  judgment?: number;
}

export interface ScoredVenue {
  candidate: VenueCandidate;
  score: number;
  confidence?: number;
  reasons: string[];
  dimensions: NowDimensionScores;
}

export interface NowPick {
  label: NowPickLabel;
  candidate: VenueCandidate;
  score: number;
  confidence?: number;
  reasons: string[];
  dimensions: NowDimensionScores;
}

export interface NowResult {
  picks: NowPick[];
  candidateCount: number;
  venueSource: string;
  judgmentSource: string;
  generatedAt: string;
  degraded: boolean;
  warnings: string[];
}

export interface RankNowInput {
  request: NowRequest;
  candidates: VenueCandidate[];
  judgments?: CandidateJudgment[];
}
