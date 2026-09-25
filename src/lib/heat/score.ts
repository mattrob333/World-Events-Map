import type { HeatSeries, HeatSourceId, HeatTicker } from './types';

/**
 * Heat scoring, pure and deterministic. Per source: the last 7 days (recent
 * days weighted more) against the median of the three weeks before, smoothed
 * with a prior so small numbers can't shout "+900%", and gated by a volume
 * floor so a thing needs both size and movement. Sources that are missing drop
 * out and lower confidence instead of counting as zero.
 */

type SourceTuning = { weight: number; prior: number; floor: number; saturation: number };

export const TUNING: Record<HeatSourceId, SourceTuning> = {
  // Weekly views: 2,000 is a small article; 500k is a global moment.
  wikipedia: { weight: 0.55, prior: 2000, floor: 3500, saturation: 500_000 },
  // Weekly mentions across the intake's sources.
  news: { weight: 0.45, prior: 3, floor: 3, saturation: 60 },
};

export const CUT = { heat: 0.55, confidence: 0.4 } as const;

const round2 = (value: number) => Math.round(value * 100) / 100;
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

function windowSum(days: HeatSeries['days'], from: number, to: number, weighted: boolean): { sum: number; observed: number } {
  let sum = 0;
  let observed = 0;
  for (let i = from; i < to; i += 1) {
    const value = days[i]?.value;
    if (value === null || value === undefined) continue;
    const age = to - 1 - i;
    sum += weighted ? value * 0.5 ** (age / 3) * (7 / weightTotal) : value;
    observed += 1;
  }
  return { sum, observed };
}
// The weights over 7 days sum to this; scaling keeps a flat week equal to its plain sum.
const weightTotal = Array.from({ length: 7 }, (_, age) => 0.5 ** (age / 3)).reduce((a, b) => a + b, 0);

export type SourceReading = { source: HeatSourceId; label: string; absolute: boolean; unit: HeatSeries['unit']; recent: number; base: number | null; deltaPct: number | null; h: number; coverage: number; perDay: number };

/** One source's reading: needs at least 28 days (4 weeks) for a baseline; with fewer it's "building". */
export function readSource(series: HeatSeries): SourceReading | null {
  const tuning = TUNING[series.source];
  const days = series.days.slice(-28);
  if (days.length < 7) return null;
  const end = days.length;
  const recentWindow = windowSum(days, end - 7, end, true);
  if (recentWindow.observed < 4) return null;
  const plainRecent = windowSum(days, end - 7, end, false).sum * (7 / Math.max(1, windowSum(days, end - 7, end, false).observed));
  const weeks = [end - 14, end - 21, end - 28].filter((start) => start >= 0).map((start) => windowSum(days, start, start + 7, false)).filter((week) => week.observed >= 4).map((week) => (week.sum * 7) / week.observed);
  const base = weeks.length >= 2 ? median(weeks) : null;
  const recent = recentWindow.sum;
  const growth = base === null ? 1 : (recent + tuning.prior) / (base + tuning.prior);
  const z = Math.max(-Math.log(10), Math.min(Math.log(10), Math.log(growth)));
  const volume = recent < tuning.floor ? 0 : Math.min(1, Math.log(recent / tuning.floor + 1) / Math.log(tuning.saturation / tuning.floor + 1));
  const moving = recent >= tuning.floor ? sigmoid(2 * z) : 0.5;
  const h = 0.6 * moving + 0.4 * volume;
  const deltaPct = base === null || base < tuning.floor / 2 ? null : Math.round(((plainRecent - base) / base) * 100);
  const observed = days.filter((day) => day.value !== null).length;
  return { source: series.source, label: series.label, absolute: series.absolute, unit: series.unit, recent, base, deltaPct, h, coverage: observed / 28, perDay: Math.round(plainRecent / 7) };
}

/** "+342%" with two significant figures, capped. */
export function formatDelta(pct: number | null): string | null {
  if (pct === null) return null;
  if (pct > 999) return '+999%+';
  const capped = Math.max(-99, Math.min(999, pct));
  const rounded = Math.abs(capped) >= 100 ? Math.round(capped / 10) * 10 : Math.round(capped);
  return `${rounded > 0 ? '+' : ''}${rounded}%${pct > 999 ? '+' : ''}`;
}

/** "12.8k", "1.2M". */
export function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(Math.round(value));
}

/** Combines the sources that are present into one ticker. Expected sources that are missing lower confidence. */
export function heatTicker(subject: { id: string; name: string; countryCode: string; kind: HeatTicker['kind']; proximity?: number }, series: readonly HeatSeries[], expected: readonly HeatSourceId[]): HeatTicker {
  const readings = series.map(readSource).filter((reading): reading is SourceReading => Boolean(reading));
  const totalWeight = expected.reduce((sum, id) => sum + TUNING[id].weight, 0) || 1;
  let weighted = 0;
  let weights = 0;
  let confidence = 0;
  for (const reading of readings) {
    const w = TUNING[reading.source].weight;
    weighted += w * reading.h;
    weights += w;
    confidence += (w / totalWeight) * Math.min(1, reading.coverage);
  }
  const heat = weights ? (weighted / weights) * (subject.proximity ?? 1) : 0;
  // The headline is the strongest absolute source with a delta.
  const lead = [...readings].filter((reading) => reading.absolute).sort((a, b) => TUNING[b.source].weight * b.h - TUNING[a.source].weight * a.h)[0];
  const aboveFloor = readings.some((reading) => reading.absolute && reading.recent >= TUNING[reading.source].floor);
  const band: HeatTicker['confidence'] = confidence >= 0.7 ? 'high' : confidence >= 0.4 ? 'medium' : 'low';
  const delta = lead?.deltaPct ?? null;
  const direction: HeatTicker['direction'] = band === 'low' || delta === null || Math.abs(delta) < 10 ? 'flat' : delta > 0 ? 'up' : 'down';
  const sparkSource = series.find((s) => s.source === lead?.source) ?? series[0];
  const observedDays = series.flatMap((s) => s.days.filter((d) => d.value !== null).map((d) => d.day)).sort();
  return {
    subjectId: subject.id,
    name: subject.name,
    countryCode: subject.countryCode,
    kind: subject.kind,
    heat: round2(heat),
    confidence: band,
    madeCut: heat >= CUT.heat && confidence >= CUT.confidence && aboveFloor,
    headline: lead ? { source: lead.source, sourceLabel: lead.label, perDay: lead.perDay, deltaPct: lead.deltaPct, absolute: lead.absolute, unit: lead.unit } : null,
    spark: (sparkSource?.days ?? []).slice(-28),
    direction,
    sources: expected.map((id) => {
      const reading = readings.find((r) => r.source === id);
      const has = series.some((s) => s.source === id);
      return { id, label: series.find((s) => s.source === id)?.label ?? id, status: reading ? (reading.base === null ? 'building' : 'ok') : has ? 'building' : 'missing' };
    }),
    asOf: observedDays[observedDays.length - 1] ?? null,
  };
}
