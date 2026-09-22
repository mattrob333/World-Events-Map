import { describe, expect, it } from 'vitest';
import { SYNTHETIC_PATCHES } from '../__fixtures__/patches';
import { signalsFromPatch } from '../from-patches';
import { buildLiveTravelWire } from '../wire';

const NOW = '2026-09-22T15:00:00.000Z';
const EVENT = {
  id: 'monaco-grand-prix',
  name: 'Monaco Grand Prix',
  city: 'Monaco',
  countryCode: 'MC',
};

describe('adapter patches become travel signals', () => {
  it('maps each known source only onto its registered metrics', () => {
    const ticketmaster = signalsFromPatch({
      sourceId: 'ticketmaster',
      eventId: EVENT.id,
      patch: { ...SYNTHETIC_PATCHES.ticketmaster, socialMentions: 9999 },
      observedAt: NOW,
      sourcePublishedAt: '2026-09-22T14:00:00.000Z',
    });
    expect(ticketmaster.map((signal) => signal.metric).sort()).toEqual([
      'ticket_price_ceiling_hint',
      'ticketed_demand_pressure',
    ]);
    expect(ticketmaster.every((signal) => signal.sourcePublishedAt === '2026-09-22T14:00:00.000Z')).toBe(true);
    expect(ticketmaster.some((signal) => signal.metric.includes('mention'))).toBe(false);

    const predicthq = signalsFromPatch({
      sourceId: 'predicthq',
      eventId: EVENT.id,
      patch: SYNTHETIC_PATCHES.predicthq,
      observedAt: NOW,
    });
    expect(predicthq.map((signal) => signal.metric).sort()).toEqual([
      'demand_rank',
      'local_demand_rank',
    ]);
    expect(predicthq.every((signal) => signal.sourcePublishedAt === undefined)).toBe(true);
    expect(JSON.stringify(predicthq)).not.toMatch(/attendance/i);
  });

  it('keeps an unknown source numeric patch and does not call it live', () => {
    const signals = signalsFromPatch({
      sourceId: 'fake',
      eventId: EVENT.id,
      patch: { searchInterest: 73 },
      observedAt: NOW,
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      sourceFamily: 'unregistered',
      metric: 'search_interest',
      truthStatus: 'modeled',
      value: 73,
    });
  });
});

describe('live travel wire', () => {
  it('stays empty when there are no provider readings', () => {
    const wire = buildLiveTravelWire({ now: NOW, observations: [] });
    expect(wire).toMatchObject({ status: 'empty', cards: [], omitted: 0 });
  });

  it('does not promote editorial baselines onto the wire', () => {
    const wire = buildLiveTravelWire({
      now: NOW,
      observations: [
        {
          sourceId: 'curated',
          eventId: EVENT.id,
          patch: SYNTHETIC_PATCHES.curated,
          observedAt: NOW,
        },
      ],
      events: [EVENT],
    });
    expect(wire.cards).toEqual([]);
    expect(wire.status).toBe('empty');
  });

  it('describes an X count change without turning it into attendance or a price', () => {
    const wire = buildLiveTravelWire({
      now: NOW,
      events: [EVENT],
      observations: [
        {
          sourceId: 'x',
          eventId: EVENT.id,
          patch: { socialMentions: 180, socialVelocity: 0.4 },
          observedAt: NOW,
          previousPatch: { socialMentions: 100, socialVelocity: 0.1 },
          previousObservedAt: '2026-09-22T14:50:00.000Z',
        },
      ],
    });
    const mentions = wire.cards.find((card) => card.metric === 'mention_count');
    expect(mentions).toMatchObject({ delta: 'rising', value: 180, previousValue: 100, city: 'Monaco' });
    expect(mentions?.headline).toContain('Monaco Grand Prix');
    const text = wire.cards.map((card) => card.headline).join(' ');
    expect(text).not.toMatch(/attendance|\$\d|sold out|viral/i);
    expect(mentions?.detail).toContain('Not attendance');
    expect(mentions?.sourcePublishedAt).toBeUndefined();
  });

  it('does not show commercially held sources as live readings', () => {
    const wire = buildLiveTravelWire({
      now: '2026-09-22T16:00:00.000Z',
      observations: [
        {
          sourceId: 'amadeus',
          eventId: EVENT.id,
          patch: SYNTHETIC_PATCHES.amadeus,
          observedAt: '2026-09-22T15:00:00.000Z',
          sourcePublishedAt: '2026-09-22T14:00:00.000Z',
        },
        {
          sourceId: 'ticketmaster',
          eventId: EVENT.id,
          patch: SYNTHETIC_PATCHES.ticketmaster,
          observedAt: '2026-09-22T15:00:00.000Z',
        },
        {
          sourceId: 'predicthq',
          eventId: EVENT.id,
          patch: SYNTHETIC_PATCHES.predicthq,
          observedAt: '2026-09-22T15:00:00.000Z',
        },
      ],
      events: [EVENT],
    });
    expect(wire.cards).toEqual([]);
    expect(wire.status).toBe('empty');
    expect(wire.note).toContain('commercial hold');
    expect(wire.note).toContain('not shown as live');
  });
});
