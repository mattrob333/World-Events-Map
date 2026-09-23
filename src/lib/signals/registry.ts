import type { BuzzSignals } from '@/lib/types';
import type { TruthStatus } from './types';

/**
 * Commercial hold from docs/data/SOURCE-ACCESS-MATRIX.md (Matt, 2026-09-22).
 * These adapters stay unconfigured. The wire may use sanitized fixtures in
 * tests, and it must not present them as live readings.
 */
export const COMMERCIAL_HOLD_SOURCE_IDS = ['amadeus', 'predicthq', 'ticketmaster'] as const;

export function isCommercialHold(sourceId: string): boolean {
  return (COMMERCIAL_HOLD_SOURCE_IDS as readonly string[]).includes(sourceId);
}

export type MetricScale = 'unit' | 'index' | 'count' | 'velocity';

export interface MetricDefinition {
  sourceId: string;
  sourceFamily: string;
  buzzField: keyof BuzzSignals;
  metric: string;
  entityType: 'event';
  truthStatus: TruthStatus;
  confidence: number;
  scale: MetricScale;
  label: string;
  /** Shown with the number so a proxy is not read as attendance, price, or heat. */
  notClaim: string;
}

/**
 * Metrics the existing adapters can actually emit. A known source never
 * publishes a buzz field that is not listed here.
 */
export const SOURCE_METRICS: readonly MetricDefinition[] = [
  {
    sourceId: 'ticketmaster',
    sourceFamily: 'events',
    buzzField: 'bookingPressure',
    metric: 'ticketed_demand_pressure',
    entityType: 'event',
    truthStatus: 'modeled',
    confidence: 0.45,
    scale: 'unit',
    label: 'Ticketed demand pressure',
    notClaim: 'A congestion and sell-through proxy. Not attendance and not a ticket price.',
  },
  {
    sourceId: 'ticketmaster',
    sourceFamily: 'events',
    buzzField: 'exclusivity',
    metric: 'ticket_price_ceiling_hint',
    entityType: 'event',
    truthStatus: 'modeled',
    confidence: 0.25,
    scale: 'unit',
    label: 'Nearby ticket ceiling hint',
    notClaim: 'A weak hint from nearby face values. Not a dope.travel price.',
  },
  {
    sourceId: 'predicthq',
    sourceFamily: 'events',
    buzzField: 'searchInterest',
    metric: 'demand_rank',
    entityType: 'event',
    truthStatus: 'modeled',
    confidence: 0.55,
    scale: 'index',
    label: 'PredictHQ demand rank',
    notClaim: 'A rank score. Predicted attendance is not mapped.',
  },
  {
    sourceId: 'predicthq',
    sourceFamily: 'events',
    buzzField: 'bookingPressure',
    metric: 'local_demand_rank',
    entityType: 'event',
    truthStatus: 'modeled',
    confidence: 0.5,
    scale: 'unit',
    label: 'PredictHQ local demand rank',
    notClaim: 'Local rank scaled to 0–1. Not hotel inventory.',
  },
  {
    sourceId: 'google-trends',
    sourceFamily: 'search',
    buzzField: 'searchInterest',
    metric: 'search_interest_index',
    entityType: 'event',
    truthStatus: 'observed',
    confidence: 0.6,
    scale: 'index',
    label: 'Search interest index',
    notClaim: 'A relative index inside one Trends query. Not absolute search volume.',
  },
  {
    sourceId: 'google-trends',
    sourceFamily: 'search',
    buzzField: 'socialVelocity',
    metric: 'search_index_slope',
    entityType: 'event',
    truthStatus: 'modeled',
    confidence: 0.4,
    scale: 'velocity',
    label: 'Search index slope',
    notClaim: 'Slope of a relative search index. Not social mention velocity.',
  },
  {
    sourceId: 'x',
    sourceFamily: 'social',
    buzzField: 'socialMentions',
    metric: 'mention_count',
    entityType: 'event',
    truthStatus: 'observed',
    confidence: 0.7,
    scale: 'count',
    label: 'X mention count',
    notClaim: 'Recent post count. Not attendance.',
  },
  {
    sourceId: 'x',
    sourceFamily: 'social',
    buzzField: 'socialVelocity',
    metric: 'mention_window_velocity',
    entityType: 'event',
    truthStatus: 'modeled',
    confidence: 0.45,
    scale: 'velocity',
    label: 'X mention window change',
    notClaim: 'Change across the recent count window. Not a full week-over-week figure.',
  },
  {
    sourceId: 'amadeus',
    sourceFamily: 'lodging',
    buzzField: 'bookingPressure',
    metric: 'upmarket_hotel_scarcity',
    entityType: 'event',
    truthStatus: 'observed',
    confidence: 0.55,
    scale: 'unit',
    label: 'Upmarket hotel scarcity',
    notClaim: 'A sampled availability proxy. Not a room price and not a booking.',
  },
  {
    sourceId: 'curated',
    sourceFamily: 'editorial',
    buzzField: 'socialMentions',
    metric: 'editorial_social_mentions',
    entityType: 'event',
    truthStatus: 'editorial',
    confidence: 0.3,
    scale: 'count',
    label: 'Editorial social baseline',
    notClaim: 'Hand-set calendar baseline. Not a live social reading.',
  },
  {
    sourceId: 'curated',
    sourceFamily: 'editorial',
    buzzField: 'socialVelocity',
    metric: 'editorial_social_velocity',
    entityType: 'event',
    truthStatus: 'editorial',
    confidence: 0.3,
    scale: 'velocity',
    label: 'Editorial velocity baseline',
    notClaim: 'Hand-set calendar baseline. Not a live social reading.',
  },
  {
    sourceId: 'curated',
    sourceFamily: 'editorial',
    buzzField: 'searchInterest',
    metric: 'editorial_search_interest',
    entityType: 'event',
    truthStatus: 'editorial',
    confidence: 0.3,
    scale: 'index',
    label: 'Editorial search baseline',
    notClaim: 'Hand-set calendar baseline. Not a live search reading.',
  },
  {
    sourceId: 'curated',
    sourceFamily: 'editorial',
    buzzField: 'mediaMentions',
    metric: 'editorial_media_mentions',
    entityType: 'event',
    truthStatus: 'editorial',
    confidence: 0.3,
    scale: 'count',
    label: 'Editorial media baseline',
    notClaim: 'Hand-set calendar baseline. Not a live press count.',
  },
  {
    sourceId: 'curated',
    sourceFamily: 'editorial',
    buzzField: 'bookingPressure',
    metric: 'editorial_booking_pressure',
    entityType: 'event',
    truthStatus: 'editorial',
    confidence: 0.3,
    scale: 'unit',
    label: 'Editorial booking baseline',
    notClaim: 'Hand-set calendar baseline. Not live availability.',
  },
  {
    sourceId: 'curated',
    sourceFamily: 'editorial',
    buzzField: 'exclusivity',
    metric: 'editorial_exclusivity',
    entityType: 'event',
    truthStatus: 'editorial',
    confidence: 0.3,
    scale: 'unit',
    label: 'Editorial exclusivity baseline',
    notClaim: 'Hand-set calendar baseline. Not a measured guest list.',
  },
] as const;

const GENERIC_BY_FIELD: Record<
  keyof BuzzSignals,
  Pick<MetricDefinition, 'metric' | 'scale' | 'label' | 'notClaim'>
> = {
  socialMentions: {
    metric: 'social_mentions',
    scale: 'count',
    label: 'Social mentions patch',
    notClaim: 'An unregistered numeric patch. Not attendance.',
  },
  socialVelocity: {
    metric: 'social_velocity',
    scale: 'velocity',
    label: 'Social velocity patch',
    notClaim: 'An unregistered numeric patch. Not social heat.',
  },
  searchInterest: {
    metric: 'search_interest',
    scale: 'index',
    label: 'Search interest patch',
    notClaim: 'An unregistered numeric patch. Not absolute demand.',
  },
  mediaMentions: {
    metric: 'media_mentions',
    scale: 'count',
    label: 'Media mentions patch',
    notClaim: 'An unregistered numeric patch. Not a press count from a named source.',
  },
  bookingPressure: {
    metric: 'booking_pressure',
    scale: 'unit',
    label: 'Booking pressure patch',
    notClaim: 'An unregistered numeric patch. Not a price or a booking.',
  },
  exclusivity: {
    metric: 'exclusivity',
    scale: 'unit',
    label: 'Exclusivity patch',
    notClaim: 'An unregistered numeric patch. Not a measured guest list.',
  },
};

export function metricsForSource(sourceId: string): MetricDefinition[] {
  return SOURCE_METRICS.filter((metric) => metric.sourceId === sourceId);
}

export function definitionFor(sourceId: string, metric: string): MetricDefinition | undefined {
  return SOURCE_METRICS.find((item) => item.sourceId === sourceId && item.metric === metric);
}

export function genericField(field: keyof BuzzSignals) {
  return GENERIC_BY_FIELD[field];
}

const SCALE_BY_METRIC = new Map<string, MetricScale>(
  SOURCE_METRICS.map((metric) => [metric.metric, metric.scale]),
);

for (const field of Object.values(GENERIC_BY_FIELD)) {
  SCALE_BY_METRIC.set(field.metric, field.scale);
}

export function scaleFor(sourceId: string, metric: string): MetricScale {
  return definitionFor(sourceId, metric)?.scale ?? SCALE_BY_METRIC.get(metric) ?? 'unit';
}

/** Absolute (and sometimes relative) move required before a number counts as rising or falling. */
export function materialThreshold(scale: MetricScale): { absolute: number; relative?: number } {
  switch (scale) {
    case 'unit':
      return { absolute: 0.08 };
    case 'index':
      return { absolute: 8 };
    case 'count':
      return { absolute: 25, relative: 0.2 };
    case 'velocity':
      return { absolute: 0.15 };
    default: {
      const never: never = scale;
      return never;
    }
  }
}
