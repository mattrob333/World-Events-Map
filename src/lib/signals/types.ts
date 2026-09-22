/**
 * Provider-neutral travel signal.
 *
 * Buzz scores on the globe stay on `BuzzSignals`. This type is the shared
 * shape for "something a source reported", before any idea or ranking step.
 * Fetch time and source publication time are different fields on purpose.
 */

export const TRUTH_STATUSES = [
  'live',
  'observed',
  'forecast',
  'modeled',
  'editorial',
] as const;

export type TruthStatus = (typeof TRUTH_STATUSES)[number];

export interface TravelSignal {
  id: string;
  sourceId: string;
  sourceFamily: string;
  entityType: string;
  entityId?: string;
  destinationId?: string;
  metric: string;
  value?: number;
  previousValue?: number;
  /** When MERIDIAN recorded the reading. Never copy this into `sourcePublishedAt`. */
  observedAt: string;
  /** When the source says the fact was published. Omit when the adapter does not provide it. */
  sourcePublishedAt?: string;
  freshnessSeconds: number;
  truthStatus: TruthStatus;
  /** 0..1. A MERIDIAN judgment of how directly this number measures the metric. */
  confidence: number;
  sourceUrl?: string;
  payloadRef?: string;
}

export const DELTA_KINDS = [
  'new',
  'rising',
  'falling',
  'changed',
  'stale',
  'recovered',
] as const;

export type DeltaKind = (typeof DELTA_KINDS)[number];

export interface SignalDelta {
  id: string;
  kind: DeltaKind;
  sourceId: string;
  sourceFamily: string;
  entityType: string;
  entityId?: string;
  destinationId?: string;
  metric: string;
  value?: number;
  previousValue?: number;
  observedAt: string;
  previousObservedAt?: string;
  sourcePublishedAt?: string;
  truthStatus: TruthStatus;
  confidence: number;
}

/** How long a buzz-adapter reading may be treated as current. Matches the 10-minute signal cache. */
export const BUZZ_PATCH_FRESHNESS_SECONDS = 10 * 60;
