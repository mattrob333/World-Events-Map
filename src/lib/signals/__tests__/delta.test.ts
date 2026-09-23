import { describe, expect, it } from 'vitest';
import { classifyMove, diffSweeps, observationIsStale } from '../delta';
import { BUZZ_PATCH_FRESHNESS_SECONDS, type TravelSignal } from '../types';

const T0 = '2026-09-22T12:00:00.000Z';
const T1 = '2026-09-22T12:05:00.000Z';
const LATER = '2026-09-22T12:20:00.000Z';

function signal(overrides: Partial<TravelSignal> = {}): TravelSignal {
  return {
    id: 'x|event|monaco-grand-prix|mention_count|t',
    sourceId: 'x',
    sourceFamily: 'social',
    entityType: 'event',
    entityId: 'monaco-grand-prix',
    metric: 'mention_count',
    value: 100,
    observedAt: T0,
    freshnessSeconds: BUZZ_PATCH_FRESHNESS_SECONDS,
    truthStatus: 'observed',
    confidence: 0.7,
    ...overrides,
  };
}

describe('delta engine', () => {
  it('marks a first fresh reading as new', () => {
    const deltas = diffSweeps([], [signal({ observedAt: T1 })], T1);
    expect(deltas.map((delta) => delta.kind)).toEqual(['new']);
    expect(deltas[0].sourcePublishedAt).toBeUndefined();
  });

  it('marks a material count increase as rising while the previous reading is fresh', () => {
    const deltas = diffSweeps(
      [signal({ value: 100, observedAt: T0 })],
      [signal({ value: 140, observedAt: T1 })],
      T1,
    );
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toMatchObject({ kind: 'rising', value: 140, previousValue: 100 });
  });

  it('ignores a count move below the absolute and relative bars', () => {
    expect(classifyMove('x', 'mention_count', 100, 120)).toBeNull();
    const deltas = diffSweeps(
      [signal({ value: 100, observedAt: T0 })],
      [signal({ value: 120, observedAt: T1 })],
      T1,
    );
    expect(deltas).toEqual([]);
  });

  it('marks a material drop as falling', () => {
    const deltas = diffSweeps(
      [signal({ value: 200, observedAt: T0 })],
      [signal({ value: 100, observedAt: T1 })],
      T1,
    );
    expect(deltas[0].kind).toBe('falling');
  });

  it('marks a truth-status change without a material move as changed', () => {
    const deltas = diffSweeps(
      [signal({ value: 100, observedAt: T0, truthStatus: 'observed' })],
      [signal({ value: 100, observedAt: T1, truthStatus: 'modeled' })],
      T1,
    );
    expect(deltas[0].kind).toBe('changed materially');
  });

  it('marks a reading past its freshness window as stale and keeps the original observed time', () => {
    const reading = signal({ observedAt: T0, sourcePublishedAt: '2026-09-22T11:00:00.000Z' });
    expect(observationIsStale(reading, LATER)).toBe(true);
    const deltas = diffSweeps([reading], [reading], LATER);
    expect(deltas[0]).toMatchObject({
      kind: 'stale',
      observedAt: T0,
      sourcePublishedAt: '2026-09-22T11:00:00.000Z',
    });
  });

  it('marks a dropped reading as stale', () => {
    const deltas = diffSweeps([signal()], [], LATER);
    expect(deltas[0].kind).toBe('stale');
  });

  it('marks a fresh reading after a gap longer than the freshness window as recovered', () => {
    const deltas = diffSweeps(
      [signal({ value: 80, observedAt: T0 })],
      [signal({ value: 200, observedAt: LATER })],
      LATER,
    );
    expect(deltas[0].kind).toBe('recovered');
    expect(deltas[0].previousValue).toBe(80);
    expect(deltas[0].value).toBe(200);
  });
});
