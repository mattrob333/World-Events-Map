import type { BuzzSignals } from '@/lib/types';
import { genericField, metricsForSource, type MetricDefinition } from './registry';
import { BUZZ_PATCH_FRESHNESS_SECONDS, type TravelSignal } from './types';

const BUZZ_FIELDS = [
  'socialMentions',
  'socialVelocity',
  'searchInterest',
  'mediaMentions',
  'bookingPressure',
  'exclusivity',
] as const satisfies readonly (keyof BuzzSignals)[];

export interface PatchObservation {
  sourceId: string;
  eventId: string;
  patch: Partial<BuzzSignals>;
  observedAt: string;
  previousPatch?: Partial<BuzzSignals>;
  previousObservedAt?: string;
  /** Publication time of the previous reading. Never copied from the current reading. */
  previousSourcePublishedAt?: string;
  sourcePublishedAt?: string;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function signalFrom(
  spec: MetricDefinition,
  observation: PatchObservation,
  value: number,
): TravelSignal {
  const signal: TravelSignal = {
    id: `${spec.sourceId}|event|${observation.eventId}|${spec.metric}|${observation.observedAt}`,
    sourceId: spec.sourceId,
    sourceFamily: spec.sourceFamily,
    entityType: spec.entityType,
    entityId: observation.eventId,
    metric: spec.metric,
    value,
    observedAt: observation.observedAt,
    freshnessSeconds: BUZZ_PATCH_FRESHNESS_SECONDS,
    truthStatus: spec.truthStatus,
    confidence: spec.confidence,
    payloadRef: `${spec.sourceId}/${observation.eventId}/${spec.metric}`,
  };
  if (observation.sourcePublishedAt) signal.sourcePublishedAt = observation.sourcePublishedAt;
  return signal;
}

/**
 * Turn one adapter patch into travel signals.
 * Known sources skip fields they are not registered to emit.
 * Unknown sources keep the number and label it unregistered.
 */
export function signalsFromPatch(observation: PatchObservation): TravelSignal[] {
  const registered = metricsForSource(observation.sourceId);
  if (registered.length) {
    return registered.flatMap((spec) => {
      const value = observation.patch[spec.buzzField];
      return finite(value) ? [signalFrom(spec, observation, value)] : [];
    });
  }

  return BUZZ_FIELDS.flatMap((field) => {
    const value = observation.patch[field];
    if (!finite(value)) return [];
    const generic = genericField(field);
    return [
      signalFrom(
        {
          sourceId: observation.sourceId,
          sourceFamily: 'unregistered',
          buzzField: field,
          metric: generic.metric,
          entityType: 'event',
          truthStatus: 'modeled',
          confidence: 0.2,
          scale: generic.scale,
          label: generic.label,
          notClaim: generic.notClaim,
        },
        observation,
        value,
      ),
    ];
  });
}

export function previousSignals(observation: PatchObservation): TravelSignal[] {
  if (!observation.previousPatch || !observation.previousObservedAt) return [];
  return signalsFromPatch({
    sourceId: observation.sourceId,
    eventId: observation.eventId,
    patch: observation.previousPatch,
    observedAt: observation.previousObservedAt,
    sourcePublishedAt: observation.previousSourcePublishedAt,
  });
}
