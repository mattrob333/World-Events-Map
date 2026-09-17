export type PartyType = 'solo' | 'family' | 'couple' | 'friends' | 'work' | 'mixed';

export interface WeightedInterest {
  name: string;
  weight: number;
}

export interface AffinityVector {
  interests: WeightedInterest[];
  partyType?: PartyType | null;
  originCity?: string | null;
  originAirport?: string | null;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AffinityReason {
  kind: 'interest' | 'party' | 'origin' | 'destination' | 'dates';
  label: string;
  points: number;
}

export interface AffinityResult {
  score: number;
  reasons: AffinityReason[];
}

export interface TravelModeRecord {
  id: string;
  user_id: string;
  name: string;
  description: string;
  party_type: PartyType;
  origin_city: string;
  origin_airport: string;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  visibility: 'private' | 'discoverable';
}

export interface TravelModeInterestRecord {
  mode_id: string;
  interest: string;
  weight: number;
}
