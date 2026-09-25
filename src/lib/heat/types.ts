/**
 * Heat: measured movement, shown like a stock ticker. Separate from the
 * editorial "buzz" score. Every number names its source; relative sources
 * never show raw counts; a missing day is a gap, never a zero.
 */

export type HeatSourceId = 'wikipedia' | 'news';

export type HeatSeries = {
  source: HeatSourceId;
  label: string;
  /** Real counts (views, mentions) or a relative index. */
  absolute: boolean;
  unit: 'views' | 'mentions';
  /** Oldest first, one per day; null = not observed. */
  days: { day: string; value: number | null }[];
};

export type HeatTicker = {
  subjectId: string;
  name: string;
  countryCode: string;
  kind: 'event' | 'place';
  heat: number;
  confidence: 'high' | 'medium' | 'low';
  madeCut: boolean;
  headline: { source: HeatSourceId; sourceLabel: string; perDay: number; deltaPct: number | null; absolute: boolean; unit: HeatSeries['unit'] } | null;
  spark: { day: string; value: number | null }[];
  direction: 'up' | 'down' | 'flat';
  sources: { id: HeatSourceId; label: string; status: 'ok' | 'missing' | 'building' }[];
  asOf: string | null;
};
