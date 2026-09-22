import { describe, expect, it } from 'vitest';
import holdSources from '@/lib/signals/__fixtures__/hold-sources.json';
import honesty from '@/lib/signals/__fixtures__/wire-honesty.json';
import type { PatchObservation } from '@/lib/signals/from-patches';
import { buildLiveTravelWire, type WireCard } from '@/lib/signals/wire';
import {
  actionHref,
  cardAsOf,
  cardBadge,
  cardEntity,
  cardMeta,
  formatValuePair,
  inventedHeatCopy,
  isCardMuted,
  shouldAnimateStream,
  shouldPulseRising,
  staleConfirmLine,
  whyRows,
  wireChrome,
} from '../travelWireView';

const EVENT = honesty.event;
const NOW = honesty.asOf;

function honestyWire() {
  return buildLiveTravelWire({
    now: NOW,
    events: [EVENT],
    observations: [honesty.fresh, honesty.stale] as PatchObservation[],
  });
}

function holdWire() {
  return buildLiveTravelWire({
    now: NOW,
    events: [EVENT],
    observations: holdSources.observations as PatchObservation[],
  });
}

function changedCard(base: WireCard): WireCard {
  return {
    ...base,
    delta: 'changed materially',
    deltaLabel: 'Changed',
    headline: `${base.label} for ${base.eventName} (${base.city}) changed.`,
  };
}

describe('Live Travel Wire UI honesty', () => {
  it('shows Rising and Stale from the honesty fixture without rewriting headlines', () => {
    const wire = honestyWire();
    const rising = wire.cards.find((card) => card.metric === 'mention_count');
    const stale = wire.cards.find((card) => card.metric === 'search_interest_index');

    expect(wire.status).toBe('observations');
    expect(rising).toBeTruthy();
    expect(stale).toBeTruthy();
    expect(cardBadge(rising!)).toBe('Rising');
    expect(cardBadge(stale!)).toBe('Stale');
    expect(cardEntity(rising!)).toBe('Monaco Grand Prix · Monaco');
    expect(rising!.headline).toBe(
      'X mention count for Monaco Grand Prix (Monaco) is higher than the previous fresh reading.',
    );
    expect(stale!.headline).toBe(
      'Search interest index for Monaco Grand Prix (Monaco) is stale.',
    );
    expect(inventedHeatCopy(rising!.headline)).toBe(false);
    expect(inventedHeatCopy(stale!.headline)).toBe(false);
    expect(inventedHeatCopy(rising!.detail)).toBe(false);

    expect(isCardMuted(rising!)).toBe(false);
    expect(isCardMuted(stale!)).toBe(true);
    expect(shouldPulseRising('observations', rising!)).toBe(true);
    expect(shouldPulseRising('observations', stale!)).toBe(false);
    expect(shouldPulseRising('degraded', rising!)).toBe(false);
    expect(shouldAnimateStream('degraded')).toBe(false);
    expect(shouldAnimateStream('empty')).toBe(false);

    const risingAsOf = cardAsOf(rising!, NOW);
    expect(risingAsOf.label).toBe('Source pub 14:40Z');
    expect(risingAsOf.absolute).toBe('22 Sep 2026 14:40Z');
    expect(risingAsOf.absolute).not.toContain('15:00');
    expect(formatValuePair(rising!.value, rising!.previousValue)).toBe('180 (was 100)');
    expect(cardMeta(rising!)).toBe('social · X mention count · observed');
    expect(staleConfirmLine(stale!)).toBe(
      'Observed 12:00Z · Last confirmed as published 11:05Z',
    );
  });

  it('renders a hold-only sweep as empty with the HOLD note and zero cards', () => {
    const wire = holdWire();
    const chrome = wireChrome(wire.status, wire.note, wire.generatedAt, NOW);

    expect(wire.cards).toEqual([]);
    expect(chrome.empty).toBe(true);
    expect(chrome.useEmptyState).toBe(true);
    expect(chrome.live).toBe(false);
    expect(chrome.emptyBody).toBe(wire.note);
    expect(chrome.emptyBody).toContain('commercial hold');
    expect(chrome.emptyBody).toContain('Ticketmaster, PredictHQ, and Amadeus');
    expect(chrome.banner).toBeNull();
    expect(JSON.stringify(wire.cards)).not.toMatch(/ticketmaster|predicthq|amadeus|attendance/i);
  });

  it('displays changed materially as Changed', () => {
    const wire = honestyWire();
    const rising = wire.cards.find((card) => card.metric === 'mention_count');
    const changed = changedCard(rising!);
    expect(cardBadge(changed)).toBe('Changed');
    expect(changed.delta).toBe('changed materially');
    expect(changed.headline).toContain('changed.');
    expect(changed.headline).not.toMatch(/FOMO|sold out|live crowd/i);
  });

  it('keeps WHY evidence on card fields and does not invent heat copy', () => {
    const wire = honestyWire();
    const rising = wire.cards.find((card) => card.metric === 'mention_count')!;
    const rows = whyRows(rising);
    expect(rows.map((row) => row.label)).toEqual([
      'Reading',
      'Value',
      'Truth',
      'Source family',
      'Source published',
      'Observed',
    ]);
    expect(rows.find((row) => row.label === 'Value')?.value).toBe('180 (was 100)');
    expect(rows.find((row) => row.label === 'Source published')?.value).toBe(
      '22 Sep 2026 14:40Z',
    );
    expect(rows.find((row) => row.label === 'Observed')?.value).toBe(
      '22 Sep 2026 15:00Z',
    );
    expect(rising.detail).toContain('Not attendance.');
    expect(inventedHeatCopy(rows.map((row) => row.value).join(' '))).toBe(false);

    const chrome = wireChrome(wire.status, wire.note, wire.generatedAt, NOW);
    expect(chrome.title).toBe('Live Travel Wire · Updated just now');
    expect(chrome.banner).toBe(wire.note);
    expect(chrome.live).toBe(true);

    const degraded = wireChrome(
      'degraded',
      'Every reading here is older than its freshness window. The observed time is unchanged. Ticketmaster, PredictHQ, and Amadeus are on commercial hold and stay unconfigured.',
      NOW,
      NOW,
    );
    expect(degraded.title).toBe('Live Travel Wire · Stale readings');
    expect(degraded.live).toBe(false);
    expect(degraded.banner).toContain('older than its freshness window');
  });

  it('gates Save / Watch / I\'d go / Start Circle on the event id', () => {
    expect(actionHref('save', 'monaco-grand-prix')).toBe(
      '/account?event=monaco-grand-prix',
    );
    expect(actionHref('watch', 'monaco-grand-prix')).toBe(
      '/account?event=monaco-grand-prix',
    );
    expect(actionHref('id_go', 'monaco-grand-prix')).toBe(
      '/community?event=monaco-grand-prix',
    );
    expect(actionHref('start_circle', 'monaco-grand-prix')).toBe(
      '/community?event=monaco-grand-prix',
    );
    expect(actionHref('share', 'monaco-grand-prix')).toBe('?event=monaco-grand-prix');
    expect(actionHref('save', undefined)).toBeNull();
  });
});
