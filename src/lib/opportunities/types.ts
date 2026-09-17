export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface VenueCandidate {
  id: string;
  provider: string;
  name: string;
  category: string;
  location: GeoPoint;
  address?: string;
  openNow?: boolean;
  closesAt?: string;
  distanceMeters?: number;
  rating?: number;
  reviewCount?: number;
  priceLevel?: number;
  expectedBusyness?: number;
  liveBusyness?: number;
  dwellMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface VenueSearchInput {
  location: GeoPoint;
  radiusMeters: number;
  at: string;
  categories?: string[];
  limit?: number;
}

export interface JudgmentQuestion {
  id: string;
  prompt: string;
}

export interface JudgmentCandidate {
  id: string;
  facts: Record<string, unknown>;
}

export interface CandidateJudgment {
  candidateId: string;
  score: number;
  confidence?: number;
  reasons: string[];
  dimensions?: Record<string, number>;
}

export interface JudgmentInput {
  context: Record<string, unknown>;
  questions: JudgmentQuestion[];
  candidates: JudgmentCandidate[];
}

export interface AviationSearchInput {
  originAirport: string;
  destinationAirport?: string;
  window: TimeWindow;
  partySize?: number;
}

export interface AviationOpportunity {
  id: string;
  provider: string;
  kind: 'empty_leg' | 'charter' | 'shared_interest';
  originAirport: string;
  destinationAirport: string;
  departureWindow: TimeWindow;
  aircraft?: string;
  capacity?: number;
  priceLabel?: string;
  status: 'opportunity' | 'provider_confirmed';
  sourceUpdatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface OpportunityInquiry {
  travelerId: string;
  message: string;
  partySize?: number;
  contactEmail?: string;
}

export interface InquiryReceipt {
  provider: string;
  inquiryId: string;
  status: 'submitted' | 'rejected';
  message?: string;
}
