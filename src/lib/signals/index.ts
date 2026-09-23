export type {
  DeltaKind,
  SignalDelta,
  TravelSignal,
  TruthStatus,
} from './types';
export { BUZZ_PATCH_FRESHNESS_SECONDS, DELTA_KINDS, TRUTH_STATUSES } from './types';

export type { MetricDefinition, MetricScale } from './registry';
export {
  SOURCE_METRICS,
  definitionFor,
  materialThreshold,
  metricsForSource,
  scaleFor,
} from './registry';

export { classifyMove, diffSweeps, observationIsStale, signalKey } from './delta';
export { previousSignals, signalsFromPatch } from './from-patches';
export type { PatchObservation } from './from-patches';
export { isCommercialHold, COMMERCIAL_HOLD_SOURCE_IDS } from './registry';
export { wireDeltaLabel, buildLiveTravelWire } from './wire';
export type { LiveTravelWire, WireCard, WireEventRef } from './wire';
