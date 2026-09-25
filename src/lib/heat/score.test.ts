import { describe, expect, it } from 'vitest';
import { formatCount, formatDelta, heatTicker, readSource } from './score';
import type { HeatSeries } from './types';

const days = (values: (number | null)[]): HeatSeries['days'] => values.map((value, i) => ({ day: `2026-08-${String(28 + i).padStart(2, '0')}`, value }));
const wiki = (values: (number | null)[]): HeatSeries => ({ source: 'wikipedia', label: 'Wikipedia views (en)', absolute: true, unit: 'views', days: days(values) });
const news = (values: (number | null)[]): HeatSeries => ({ source: 'news', label: 'News mentions', absolute: true, unit: 'mentions', days: days(values) });
const flat = (n: number, value: number) => Array.from({ length: n }, () => value);

describe('Heat scoring', () => {
  it('reads a real surge (Oktoberfest-sized) as hot, up, with an honest delta', () => {
    const series = wiki([...flat(21, 2900), 4000, 6000, 8000, 10000, 11500, 12500, 12800]);
    const reading = readSource(series)!;
    expect(reading.deltaPct).toBeGreaterThan(200);
    const ticker = heatTicker({ id: 'event:oktoberfest', name: 'Oktoberfest', countryCode: 'DE', kind: 'event' }, [series, news([...flat(21, 1), 2, 3, 4, 5, 6, 6, 7])], ['wikipedia', 'news']);
    expect(ticker.madeCut).toBe(true);
    expect(ticker.direction).toBe('up');
    expect(ticker.headline?.source).toBe('wikipedia');
    expect(ticker.confidence).toBe('high');
  });

  it('never lets tiny numbers shout: 10 → 40 views a day is not hot and shows no big percentage', () => {
    const ticker = heatTicker({ id: 'place:tiny', name: 'Tiny Village', countryCode: 'CH', kind: 'place' }, [wiki([...flat(21, 10), 40, 40, 40, 40, 40, 40, 40])], ['wikipedia', 'news']);
    expect(ticker.madeCut).toBe(false);
    expect(ticker.headline?.deltaPct).toBeNull();
  });

  it('treats a missing source as missing, not zero, and lowers confidence', () => {
    const series = wiki([...flat(21, 20000), ...flat(7, 60000)]);
    const both = heatTicker({ id: 'a', name: 'A', countryCode: 'FR', kind: 'event' }, [series], ['wikipedia']);
    const oneOfTwo = heatTicker({ id: 'a', name: 'A', countryCode: 'FR', kind: 'event' }, [series], ['wikipedia', 'news']);
    expect(oneOfTwo.sources.find((s) => s.id === 'news')?.status).toBe('missing');
    expect(oneOfTwo.heat).toBe(both.heat);
    expect(['medium', 'low']).toContain(oneOfTwo.confidence);
    // Gaps stay gaps in the sparkline.
    const gappy = heatTicker({ id: 'b', name: 'B', countryCode: 'FR', kind: 'event' }, [wiki([...flat(20, 5000), null, ...flat(7, 5000)])], ['wikipedia']);
    expect(gappy.spark.some((point) => point.value === null)).toBe(true);
  });

  it('something far away in time cools off even if people are reading about it', () => {
    const series = wiki([...flat(21, 20000), ...flat(7, 60000)]);
    const soon = heatTicker({ id: 'e', name: 'E', countryCode: 'JP', kind: 'event', proximity: 1 }, [series], ['wikipedia']);
    const far = heatTicker({ id: 'e', name: 'E', countryCode: 'JP', kind: 'event', proximity: 0.3 }, [series], ['wikipedia']);
    expect(far.heat).toBeLessThan(soon.heat);
  });

  it('formats like a ticker', () => {
    expect(formatDelta(342)).toBe('+340%');
    expect(formatDelta(12)).toBe('+12%');
    expect(formatDelta(-35)).toBe('-35%');
    expect(formatDelta(4200)).toBe('+999%+');
    expect(formatCount(12780)).toBe('13k');
    expect(formatCount(1_240_000)).toBe('1.2M');
    expect(formatCount(2894)).toBe('2.9k');
  });
});
