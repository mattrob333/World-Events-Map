import { materialThreshold, scaleFor } from './registry';
import type { DeltaKind, SignalDelta, TravelSignal } from './types';

export function signalKey(
  signal: Pick<TravelSignal, 'sourceId' | 'entityType' | 'entityId' | 'metric'>,
): string {
  return [signal.sourceId, signal.entityType, signal.entityId ?? '', signal.metric].join('|');
}

/** True when `atIso` is later than the reading by more than its freshness window. */
export function observationIsStale(signal: TravelSignal, atIso: string): boolean {
  const at = Date.parse(atIso);
  const observed = Date.parse(signal.observedAt);
  if (!Number.isFinite(at) || !Number.isFinite(observed)) return true;
  return at - observed > signal.freshnessSeconds * 1000;
}

export function classifyMove(
  sourceId: string,
  metric: string,
  previous?: number,
  next?: number,
): 'rising' | 'falling' | null {
  if (previous === undefined || next === undefined) return null;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return null;
  const delta = next - previous;
  const { absolute, relative } = materialThreshold(scaleFor(sourceId, metric));
  if (Math.abs(delta) < absolute) return null;
  if (relative !== undefined) {
    const base = Math.abs(previous);
    const ratio = base === 0 ? (delta === 0 ? 0 : 1) : Math.abs(delta) / base;
    if (ratio < relative) return null;
  }
  if (delta > 0) return 'rising';
  if (delta < 0) return 'falling';
  return null;
}

function indexByKey(signals: TravelSignal[]): Map<string, TravelSignal> {
  const map = new Map<string, TravelSignal>();
  for (const signal of signals) map.set(signalKey(signal), signal);
  return map;
}

function deltaFrom(
  kind: DeltaKind,
  signal: TravelSignal,
  extras: { previous?: TravelSignal } = {},
): SignalDelta {
  const previous = extras.previous;
  return {
    id: `${signalKey(signal)}|${kind}|${signal.observedAt}`,
    kind,
    sourceId: signal.sourceId,
    sourceFamily: signal.sourceFamily,
    entityType: signal.entityType,
    entityId: signal.entityId,
    destinationId: signal.destinationId,
    metric: signal.metric,
    value: signal.value,
    previousValue: previous?.value,
    observedAt: signal.observedAt,
    previousObservedAt: previous?.observedAt,
    sourcePublishedAt: signal.sourcePublishedAt,
    truthStatus: signal.truthStatus,
    confidence: signal.confidence,
  };
}

/**
 * Compare two sweeps of the same signals.
 *
 * Rising and falling require the previous reading to still be inside its
 * freshness window. A new reading after that window is `recovered`, not a
 * continuous rise. A missing current reading is `stale`. Fetch time is never
 * written over `sourcePublishedAt`.
 */
export function diffSweeps(
  previous: TravelSignal[],
  current: TravelSignal[],
  sweptAt: string,
): SignalDelta[] {
  const previousByKey = indexByKey(previous);
  const currentByKey = indexByKey(current);
  const keys = [...new Set([...previousByKey.keys(), ...currentByKey.keys()])].sort();
  const deltas: SignalDelta[] = [];

  for (const key of keys) {
    const prior = previousByKey.get(key);
    const next = currentByKey.get(key);

    if (!next && prior) {
      deltas.push(deltaFrom('stale', prior));
      continue;
    }
    if (!next) continue;

    if (observationIsStale(next, sweptAt)) {
      deltas.push(deltaFrom('stale', next, { previous: prior }));
      continue;
    }
    if (!prior) {
      deltas.push(deltaFrom('new', next));
      continue;
    }
    if (observationIsStale(prior, next.observedAt)) {
      deltas.push(deltaFrom('recovered', next, { previous: prior }));
      continue;
    }

    const move = classifyMove(next.sourceId, next.metric, prior.value, next.value);
    if (move) {
      deltas.push(deltaFrom(move, next, { previous: prior }));
      continue;
    }
    const valueMissing =
      (prior.value === undefined) !== (next.value === undefined);
    if (valueMissing || prior.truthStatus !== next.truthStatus) {
      deltas.push(deltaFrom('changed materially', next, { previous: prior }));
    }
  }

  return deltas;
}
