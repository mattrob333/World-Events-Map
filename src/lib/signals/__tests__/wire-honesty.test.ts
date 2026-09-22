import { describe, expect, it } from 'vitest';
import holdSources from '../__fixtures__/hold-sources.json';
import honesty from '../__fixtures__/wire-honesty.json';
import type { PatchObservation } from '../from-patches';
import { buildLiveTravelWire, wireDeltaLabel, type WireCard } from '../wire';

const freshObservations = honesty.fresh as PatchObservation[];
const staleObservation = honesty.stale as PatchObservation;

const ACTIVE_KINDS = new Set(['new', 'rising', 'falling', 'changed materially']);

function wireFromHonesty() {
  return buildLiveTravelWire({
    now: honesty.asOf,
    events: [honesty.event],
    observations: [...freshObservations, staleObservation],
  });
}

function assertDistinctPublicationTimes(card: WireCard | undefined) {
  expect(card?.sourcePublishedAt).toBeTruthy();
  expect(card?.sourcePublishedAt).not.toBe(card?.observedAt);
  expect(card?.sourcePublishedAt).not.toBe(honesty.asOf);
  expect(card?.observedAt).not.toBe(honesty.asOf);
}

describe('wire honesty fixtures', () => {
  it('shows two fresh source families on the same entity without inventing heat', () => {
    const wire = wireFromHonesty();
    const freshCards = wire.cards.filter((card) => ACTIVE_KINDS.has(card.delta));
    const families = new Set(freshCards.map((card) => card.sourceFamily));

    expect(freshCards.length).toBeGreaterThanOrEqual(2);
    expect(families.size).toBeGreaterThanOrEqual(2);
    expect(families).toEqual(new Set(['social', 'search']));
    expect(freshCards.every((card) => card.eventId === honesty.event.id)).toBe(true);
    // ENTITY-REGISTRY has no destination id yet — do not invent one on the fixture.
    expect(freshObservations.every((observation) => !('destinationId' in observation))).toBe(true);

    const social = freshCards.find((card) => card.sourceId === 'x' && card.metric === 'mention_count');
    const search = freshCards.find(
      (card) => card.sourceId === 'google-trends' && card.metric === 'search_interest_index',
    );

    expect(social).toMatchObject({
      delta: 'rising',
      deltaLabel: 'Rising',
      sourceFamily: 'social',
      value: 180,
      previousValue: 100,
    });
    expect(search).toMatchObject({
      delta: 'rising',
      deltaLabel: 'Rising',
      sourceFamily: 'search',
      value: 55,
      previousValue: 36,
    });

    const headlines = wire.cards.map((card) => card.headline).join(' ');
    expect(headlines).not.toMatch(/attendance|\$\d|sold out|viral|heat/i);
    expect(social?.detail).toContain('Not attendance');
    expect(search?.detail).toContain('Not absolute search volume');
  });

  it('keeps source publication time on fresh and stale cards', () => {
    const wire = wireFromHonesty();
    const xFresh = freshObservations.find((observation) => observation.sourceId === 'x');
    const trendsFresh = freshObservations.find((observation) => observation.sourceId === 'google-trends');

    const mention = wire.cards.find((card) => card.metric === 'mention_count' && card.delta !== 'stale');
    expect(mention).toMatchObject({
      delta: 'rising',
      deltaLabel: 'Rising',
      observedAt: xFresh?.observedAt,
      sourcePublishedAt: xFresh?.sourcePublishedAt,
      value: 180,
      previousValue: 100,
    });
    assertDistinctPublicationTimes(mention);
    expect(mention?.detail).toContain(`Source published ${xFresh?.sourcePublishedAt}.`);

    const search = wire.cards.find(
      (card) => card.metric === 'search_interest_index' && card.delta !== 'stale',
    );
    expect(search).toMatchObject({
      delta: 'rising',
      observedAt: trendsFresh?.observedAt,
      sourcePublishedAt: trendsFresh?.sourcePublishedAt,
      value: 55,
      previousValue: 36,
    });
    assertDistinctPublicationTimes(search);
    expect(search?.detail).toContain(`Source published ${trendsFresh?.sourcePublishedAt}.`);

    const stale = wire.cards.find((card) => card.metric === 'search_interest_index' && card.delta === 'stale');
    expect(stale).toMatchObject({
      delta: 'stale',
      deltaLabel: 'Stale',
      observedAt: honesty.stale.observedAt,
      sourcePublishedAt: honesty.stale.sourcePublishedAt,
    });
    assertDistinctPublicationTimes(stale);
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
    expect(JSON.stringify(holdSources.observations)).toMatch(/ticketmaster/);
    expect(JSON.stringify(holdSources.observations)).toMatch(/predicthq/);
    expect(JSON.stringify(holdSources.observations)).toMatch(/amadeus/);
  });
});
