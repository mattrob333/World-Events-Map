import { describe, expect, it } from 'vitest';
import holdSources from '../__fixtures__/hold-sources.json';
import honesty from '../__fixtures__/wire-honesty.json';
import type { PatchObservation } from '../from-patches';
import { buildLiveTravelWire, wireDeltaLabel } from '../wire';

describe('wire honesty fixtures', () => {
  it('keeps source publication time on fresh and stale cards', () => {
    const wire = buildLiveTravelWire({
      now: honesty.asOf,
      events: [honesty.event],
      observations: [honesty.fresh, honesty.stale] as PatchObservation[],
    });

    const fresh = wire.cards.find((card) => card.metric === 'mention_count');
    expect(fresh).toMatchObject({
      delta: 'rising',
      deltaLabel: 'Rising',
      observedAt: honesty.fresh.observedAt,
      sourcePublishedAt: honesty.fresh.sourcePublishedAt,
      value: 180,
      previousValue: 100,
    });
    expect(fresh?.sourcePublishedAt).not.toBe(fresh?.observedAt);
    expect(fresh?.sourcePublishedAt).not.toBe(honesty.asOf);
    expect(fresh?.detail).toContain(`Source published ${honesty.fresh.sourcePublishedAt}.`);

    const stale = wire.cards.find((card) => card.metric === 'search_interest_index');
    expect(stale).toMatchObject({
      delta: 'stale',
      deltaLabel: 'Stale',
      observedAt: honesty.stale.observedAt,
      sourcePublishedAt: honesty.stale.sourcePublishedAt,
    });
    expect(stale?.observedAt).not.toBe(honesty.asOf);
    expect(stale?.sourcePublishedAt).not.toBe(honesty.asOf);
    expect(stale?.sourcePublishedAt).not.toBe(stale?.observedAt);
    expect(stale?.detail).toContain(`Observed ${honesty.stale.observedAt}.`);
    expect(stale?.detail).toContain(`Source published ${honesty.stale.sourcePublishedAt}.`);
  });

  it('labels a material non-directional change as Changed', () => {
    expect(wireDeltaLabel('changed materially')).toBe('Changed');
  });

  it('does not promote held-source fixtures onto the live wire', () => {
    const wire = buildLiveTravelWire({
      now: honesty.asOf,
      events: [honesty.event],
      observations: holdSources.observations as PatchObservation[],
    });
    expect(wire.cards).toEqual([]);
    expect(wire.status).toBe('empty');
    expect(wire.note).toContain('commercial hold');
    expect(JSON.stringify(wire.cards)).not.toMatch(/ticketmaster|predicthq|amadeus/);
  });
});
