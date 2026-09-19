/**
 * Destination Pulse — the first-class place object.
 *
 * Events remain in the World Graph. Destinations are how travelers think.
 * Scores and reasons are derived from curated calendar records and the
 * existing buzz model. Nothing here is a live attendance count, a live
 * weather observation, or a confirmed booking.
 */

import type { GeoPoint } from '@/lib/types';

export const DESTINATION_ARCHETYPES = [
  'ski',
  'beach',
  'nightlife',
  'festival',
  'motorsport',
  'sailing',
  'culture',
  'food',
  'nature',
  'wellness',
] as const;

export type DestinationArchetype = (typeof DESTINATION_ARCHETYPES)[number];

export const PULSE_STATUSES = [
  'live',
  'heating_up',
  'seasonal',
  'steady',
  'cooling',
] as const;

export type PulseStatus = (typeof PULSE_STATUSES)[number];

/**
 * Where a number or claim came from. The UI must show this, not a mysterious
 * score. `live_observation` is reserved and unused until a provider actually
 * returns a live reading.
 */
export const PROVENANCE_KINDS = [
  'curated_calendar',
  'modeled_demand',
  'updated_signals',
  'seasonal_calendar',
  'editorial_fixture',
  'member_local',
] as const;

export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export interface SignalFact {
  /** Display value already scaled for humans (0–100 unless `unit` says otherwise). */
  value: number;
  unit?: string;
  label: string;
  direction?: 'up' | 'down' | 'flat';
  provenance: ProvenanceKind;
  /** ISO timestamp, or `calendar` when the fact is a dated curated record. */
  freshness: string;
  /** One-line honesty about what the number is. */
  note: string;
}

export interface PulseReason {
  id: string;
  /** Short traveler-facing line, no trailing period. */
  text: string;
  weight: number;
  provenance: ProvenanceKind;
}

export interface WeatherContext {
  destinationId: string;
  /** Human season label derived from calendar, not a live observation. */
  seasonLabel: string;
  windowLabel: string;
  note: string;
  provenance: ProvenanceKind;
}

export interface WeatherContextProvider {
  getDestinationContext(
    destinationId: string,
    window: { start: string; end: string },
  ): Promise<WeatherContext>;
}

export interface DestinationPulse {
  id: string;
  slug: string;
  name: string;
  country: string;
  region?: string;
  countryCode: string;
  coords: GeoPoint;
  timezone: string;

  score: number;
  trend: number;
  status: PulseStatus;
  archetypes: DestinationArchetype[];

  whyNow: string;
  reasons: PulseReason[];
  signals: {
    events?: SignalFact;
    social?: SignalFact;
    search?: SignalFact;
    booking?: SignalFact;
    venues?: SignalFact;
    weather?: SignalFact;
    members?: SignalFact;
  };

  eventIds: string[];
  leadEventId: string | null;
  updatedAt: string;
}

export const STATUS_LABEL: Record<PulseStatus, string> = {
  live: 'On the calendar now',
  heating_up: 'Heating up',
  seasonal: 'Seasonal window',
  steady: 'Steady',
  cooling: 'Cooling',
};

export const PROVENANCE_LABEL: Record<ProvenanceKind, string> = {
  curated_calendar: 'Curated calendar',
  modeled_demand: 'Modeled demand',
  updated_signals: 'Updated signals',
  seasonal_calendar: 'Seasonal calendar context',
  editorial_fixture: 'Editorial fixture',
  member_local: 'Saved on this device',
};
