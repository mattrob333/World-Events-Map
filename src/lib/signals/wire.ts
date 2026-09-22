import { diffSweeps } from './delta';
import { previousSignals, signalsFromPatch, type PatchObservation } from './from-patches';
import { definitionFor, genericField } from './registry';
import type { BuzzSignals } from '@/lib/types';
import type { DeltaKind, SignalDelta, TruthStatus } from './types';

export interface WireEventRef {
  id: string;
  name: string;
  city: string;
  countryCode: string;
}

export interface WireCard {
  id: string;
  delta: DeltaKind;
  sourceId: string;
  sourceFamily: string;
  metric: string;
  label: string;
  eventId?: string;
  eventName?: string;
  city?: string;
  headline: string;
  detail: string;
  observedAt: string;
  sourcePublishedAt?: string;
  value?: number;
  previousValue?: number;
  truthStatus: TruthStatus;
  confidence: number;
}

export interface LiveTravelWire {
  generatedAt: string;
  status: 'empty' | 'observations' | 'degraded';
  note: string;
  cards: WireCard[];
  omitted: number;
}

const CARD_LIMIT = 24;

const DELTA_RANK: Record<DeltaKind, number> = {
  recovered: 0,
  rising: 1,
  falling: 2,
  new: 3,
  changed: 4,
  stale: 5,
};

const GENERIC_NOT_CLAIM = new Map<string, { label: string; notClaim: string }>(
  (Object.keys({
    socialMentions: true,
    socialVelocity: true,
    searchInterest: true,
    mediaMentions: true,
    bookingPressure: true,
    exclusivity: true,
  }) as (keyof BuzzSignals)[]).map((field) => {
    const generic = genericField(field);
    return [generic.metric, { label: generic.label, notClaim: generic.notClaim }];
  }),
);

function copyFor(delta: SignalDelta): { label: string; notClaim: string } {
  const known = definitionFor(delta.sourceId, delta.metric);
  if (known) return { label: known.label, notClaim: known.notClaim };
  return (
    GENERIC_NOT_CLAIM.get(delta.metric) ?? {
      label: delta.metric,
      notClaim: 'An unregistered numeric patch. Not attendance, a price, or social heat.',
    }
  );
}

function formatValue(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return 'n/a';
  const rounded = Math.round(value * 1000) / 1000;
  return String(rounded);
}

function subject(delta: SignalDelta, event?: WireEventRef): string {
  if (event) return `${event.name} (${event.city})`;
  return delta.entityId ?? 'this event';
}

function headline(delta: SignalDelta, label: string, event?: WireEventRef): string {
  const where = subject(delta, event);
  switch (delta.kind) {
    case 'new':
      return `New reading: ${label} for ${where}.`;
    case 'rising':
      return `${label} for ${where} is higher than the previous fresh reading.`;
    case 'falling':
      return `${label} for ${where} is lower than the previous fresh reading.`;
    case 'changed':
      return `${label} for ${where} changed.`;
    case 'stale':
      return `${label} for ${where} is stale.`;
    case 'recovered':
      return `${label} for ${where} has a fresh reading again.`;
    default: {
      const never: never = delta.kind;
      return never;
    }
  }
}

function detail(delta: SignalDelta, label: string, notClaim: string): string {
  const published = delta.sourcePublishedAt
    ? ` Source published ${delta.sourcePublishedAt}.`
    : '';
  return `${label} is ${formatValue(delta.value)} (previous ${formatValue(delta.previousValue)}). ${notClaim} Observed ${delta.observedAt}.${published}`;
}

function cardFor(delta: SignalDelta, events: Map<string, WireEventRef>): WireCard | null {
  if (delta.truthStatus === 'editorial') return null;
  const copy = copyFor(delta);
  const event = delta.entityId ? events.get(delta.entityId) : undefined;
  return {
    id: delta.id,
    delta: delta.kind,
    sourceId: delta.sourceId,
    sourceFamily: delta.sourceFamily,
    metric: delta.metric,
    label: copy.label,
    eventId: delta.entityId,
    eventName: event?.name,
    city: event?.city,
    headline: headline(delta, copy.label, event),
    detail: detail(delta, copy.label, copy.notClaim),
    observedAt: delta.observedAt,
    sourcePublishedAt: delta.sourcePublishedAt,
    value: delta.value,
    previousValue: delta.previousValue,
    truthStatus: delta.truthStatus,
    confidence: delta.confidence,
  };
}

/**
 * Build the live wire from per-source patches the existing adapters already
 * returned. Editorial baselines are left off. Empty input stays empty.
 */
export function buildLiveTravelWire(input: {
  now: string;
  observations: PatchObservation[];
  events?: WireEventRef[];
}): LiveTravelWire {
  const events = new Map((input.events ?? []).map((event) => [event.id, event]));
  const cards: WireCard[] = [];

  for (const observation of input.observations) {
    const deltas = diffSweeps(
      previousSignals(observation),
      signalsFromPatch(observation),
      input.now,
    );
    for (const delta of deltas) {
      const card = cardFor(delta, events);
      if (card) cards.push(card);
    }
  }

  cards.sort((a, b) => {
    const rank = DELTA_RANK[a.delta] - DELTA_RANK[b.delta];
    if (rank !== 0) return rank;
    return b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id);
  });

  const omitted = Math.max(0, cards.length - CARD_LIMIT);
  const visible = cards.slice(0, CARD_LIMIT);
  const allStale = visible.length > 0 && visible.every((card) => card.delta === 'stale');
  const status: LiveTravelWire['status'] =
    visible.length === 0 ? 'empty' : allStale ? 'degraded' : 'observations';

  const note =
    status === 'empty'
      ? 'No provider readings to show. Curated calendar scores stay on the globe and are not treated as live signals.'
      : allStale
        ? 'Every reading here is older than its freshness window. The observed time is unchanged.'
        : 'These cards repeat numbers already returned by configured adapters. A card is not attendance, a price, or a booking.';

  return {
    generatedAt: input.now,
    status,
    note: omitted ? `${note} ${omitted} more readings are hidden so the wire stays short.` : note,
    cards: visible,
    omitted,
  };
}
