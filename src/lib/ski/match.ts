import type { Signal } from '@/lib/vibe/signals';
import { INTERESTS, type Currency, type Interest, type SceneItem, type SkiRange, type SkiResort } from './types';
import { candidateWeeks, crowdWeeks, formatSpan, monthWeights, overlaps, type TripWindow, type Week } from './window';

/**
 * The ski matcher: given when someone can go and what they like, which range,
 * which resort and which week give them the most good things to do. Pure and
 * deterministic, from the checked data only. No paid lookups.
 *
 * The score is about the whole trip: snow first, then everything around the
 * resort that fits them, counting a mix of kinds above a pile of one kind, so
 * a town with forty bars doesn't beat one with a party, a show and a great dinner.
 */

export type Tone = 'good' | 'season' | 'off';

// ── What they like ──────────────────────────────────────────────────────────

/** Vibe profile signal → the planner's interests. Named genres and artists are matched by prefix. */
const SIGNAL_INTERESTS: Record<string, Interest[]> = {
  'nights:apres': ['apres'],
  'nights:dance': ['dj', 'nightlife'],
  'nights:hip-hop': ['dj', 'nightlife'],
  'nights:latin': ['dj', 'nightlife'],
  'nights:live-music': ['live-music'],
  'nights:rock': ['live-music', 'concert'],
  'nights:jazz': ['live-music'],
  'nights:honky-tonk': ['live-music'],
  'nights:last-call': ['nightlife'],
  'nights:cocktail-bar': ['nightlife'],
  'nights:speakeasy': ['nightlife'],
  'nights:rooftop': ['nightlife'],
  'nights:lounge': ['nightlife'],
  'nights:dive-bar': ['nightlife'],
  'nights:karaoke': ['nightlife'],
  'nights:wine-bar': ['nightlife', 'food'],
  'culture:concert-hall': ['concert'],
  'culture:festivals': ['festival'],
  'culture:art': ['culture'],
  'culture:theatre': ['culture'],
  'culture:history': ['culture'],
  'culture:architecture': ['culture'],
  'culture:comedy': ['culture'],
  'food:tasting-menu': ['fine-dining', 'food'],
  'money:splurge-food': ['fine-dining', 'food'],
  'food:wine': ['fine-dining', 'food'],
  'stay:spa': ['spa'],
  'stay:luxury': ['luxury'],
  'money:splurge-stay': ['luxury'],
  'money:splurge-experiences': ['adventure', 'luxury'],
  'sports:hike': ['adventure', 'scenery'],
};
const ELECTRONIC = /\b(house|techno|edm|electronic|dance|trance|dubstep|drum and bass|dnb|garage|disco)\b/i;

function interestsForSignal(signal: Signal): Interest[] {
  const direct = SIGNAL_INTERESTS[signal.key];
  if (direct) return direct;
  if (signal.key.startsWith('music:artist:')) return ['concert', 'live-music'];
  if (signal.key.startsWith('music:genre:')) return ELECTRONIC.test(signal.label) ? ['dj'] : ['live-music', 'concert'];
  if (signal.key.startsWith('sports:watch-') || signal.key.startsWith('sports:team:')) return ['sports'];
  if (signal.key.startsWith('food:') && !/vegetarian|vegan|gluten/.test(signal.key)) return ['food'];
  return [];
}

export type Weights = Record<Interest, number>;

/**
 * How much each interest counts for them: 1 by default, 2 for a like, 3 for a
 * love, 0 for something they avoid. No profile means every interest counts the same.
 */
export function interestWeights(signals: readonly Signal[], party?: 'family' | 'crew'): Weights {
  const weights = Object.fromEntries(INTERESTS.map((interest) => [interest, 1])) as Weights;
  const avoided = new Set<Interest>();
  for (const signal of signals) {
    for (const interest of interestsForSignal(signal)) {
      if (signal.strength === 'avoid') avoided.add(interest);
      else weights[interest] = Math.max(weights[interest], signal.strength === 'love' ? 3 : 2);
    }
  }
  for (const interest of avoided) weights[interest] = 0;
  if (party === 'family') weights.family = Math.max(weights.family, 2.5);
  return weights;
}

/** Did the profile say anything the planner can use? */
export const hasTaste = (weights: Weights) => INTERESTS.some((interest) => weights[interest] !== 1);

// ── Snow ────────────────────────────────────────────────────────────────────

function inSeason(month: number, opens: number, closes: number) {
  return opens <= closes ? month >= opens && month <= closes : month >= opens || month <= closes;
}

/** 0 to 1: how good the snow usually is across the window, weighted by days. */
export function snowFit(months: Map<number, number>, best: readonly number[], open: (month: number) => boolean): number {
  let total = 0;
  let score = 0;
  for (const [month, days] of months) {
    total += days;
    score += days * (best.includes(month) ? 1 : open(month) ? 0.55 : 0);
  }
  return total ? score / total : 0;
}

export const toneFor = (fit: number): Tone => (fit >= 0.75 ? 'good' : fit > 0.2 ? 'season' : 'off');

// ── Things to do ────────────────────────────────────────────────────────────

const WOW_POINTS = { 1: 1, 2: 2.5, 3: 5 } as const;
/** Each extra item of the same kind counts for less: variety beats volume. */
const DECAY = [1, 0.7, 0.5, 0.35, 0.25, 0.2];

/** Is the item on during the window: its dates if it has them, else its months? */
export function itemInWindow(item: SceneItem, window: Pick<TripWindow, 'from' | 'to'>, months: Map<number, number>): boolean {
  if (item.dates) return overlaps(item.dates.start, item.dates.end, window.from, window.to);
  return item.months.some((month) => months.has(month));
}

export function itemPoints(item: SceneItem, weights: Weights): number {
  const fit = Math.max(0, ...item.interests.map((interest) => weights[interest] ?? 1));
  return WOW_POINTS[item.wow] * fit * (item.dates ? 1.2 : 1);
}

/** An item they'd like: it hits something in their profile, or (with no profile) it's great. */
export function isForThem(item: SceneItem, weights: Weights): boolean {
  if (item.interests.some((interest) => weights[interest] === 0)) return false;
  return hasTaste(weights) ? item.interests.some((interest) => weights[interest] >= 2) : item.wow >= 2;
}

function sceneScore(items: readonly SceneItem[], weights: Weights): number {
  const byKind = new Map<string, number[]>();
  for (const item of items) {
    const list = byKind.get(item.kind) ?? [];
    list.push(itemPoints(item, weights));
    byKind.set(item.kind, list);
  }
  let total = 0;
  for (const points of byKind.values()) {
    points.sort((a, b) => b - a);
    points.forEach((value, index) => (total += value * (DECAY[index] ?? 0.15)));
  }
  return total;
}

// ── Prices ──────────────────────────────────────────────────────────────────

export type PriceBand = 'value' | 'mid' | 'premium';
export const PRICE_BAND_LABEL: Record<PriceBand, string> = { value: 'Good value', mid: 'Mid-range', premium: 'Premium' };

/** Rough US dollars per unit, only to sort prices into bands. Never shown as a price. */
const ROUGH_USD: Partial<Record<Currency, number>> = {
  USD: 1, CAD: 0.72, EUR: 1.1, CHF: 1.15, JPY: 0.0068, NZD: 0.6, AUD: 0.66, CLP: 0.00105, NOK: 0.095, SEK: 0.095,
};

/** Value, mid or premium, from the middle of the published range. Null when the currency moves too fast to band. */
export function priceBand(resort: SkiResort): PriceBand | null {
  const ticket = resort.liftTicket;
  const rate = ticket ? ROUGH_USD[ticket.currency] : undefined;
  if (!ticket || !rate) return null;
  const mid = ((ticket.low + ticket.high) / 2) * rate;
  return mid < 110 ? 'value' : mid < 200 ? 'mid' : 'premium';
}

const SYMBOL: Partial<Record<Currency, string>> = { USD: '$', CAD: 'C$', EUR: '€', CHF: 'CHF ', JPY: '¥', NZD: 'NZ$', AUD: 'A$', NOK: 'NOK ', SEK: 'SEK ', CLP: 'CLP ', ARS: 'ARS ' };

/** "$204 to $299" or "€72" when there's one price. */
export function formatTicket(resort: SkiResort): string | null {
  const ticket = resort.liftTicket;
  if (!ticket) return null;
  const fmt = (value: number) => `${SYMBOL[ticket.currency] ?? ''}${value.toLocaleString('en-US')}`;
  if (ticket.fromOnly) return `from ${fmt(ticket.low)}`;
  return ticket.low === ticket.high ? fmt(ticket.low) : `${fmt(ticket.low)} to ${fmt(ticket.high)}`;
}

// ── Ranking ─────────────────────────────────────────────────────────────────

export interface ResortMatch {
  resort: SkiResort;
  score: number;
  fit: number;
  tone: Tone;
  /** What's on in the window that fits them, best first. */
  forThem: SceneItem[];
  /** Everything on in the window, best first. */
  inWindow: SceneItem[];
  band: PriceBand | null;
}

const VIBE_INTEREST: Partial<Record<string, Interest>> = { apres: 'apres', nightlife: 'nightlife', luxury: 'luxury', family: 'family' };

export function matchResort(resort: SkiResort, scene: readonly SceneItem[], window: TripWindow, weights: Weights): ResortMatch {
  const months = monthWeights(window.from, window.to);
  const fit = snowFit(months, resort.bestMonths, (month) => inSeason(month, resort.season.opensMonth, resort.season.closesMonth));
  const inWindow = scene
    .filter((item) => item.resortId === resort.id && itemInWindow(item, window, months))
    .sort((a, b) => itemPoints(b, weights) - itemPoints(a, weights) || a.name.localeCompare(b.name));
  const vibeBonus = resort.vibe.reduce((sum, vibe) => sum + Math.max(0, (weights[VIBE_INTEREST[vibe] as Interest] ?? 1) - 1) * 3, 0);
  // No snow, no ski trip: the rest only counts when the mountain is open.
  const score = fit * 40 + (fit > 0 ? sceneScore(inWindow, weights) + vibeBonus : 0);
  return {
    resort,
    score,
    fit,
    tone: toneFor(fit),
    forThem: inWindow.filter((item) => isForThem(item, weights)),
    inWindow,
    band: priceBand(resort),
  };
}

export function rankResorts(resorts: readonly SkiResort[], scene: readonly SceneItem[], window: TripWindow, weights: Weights): ResortMatch[] {
  return resorts
    .map((resort) => matchResort(resort, scene, window, weights))
    .sort((a, b) => b.score - a.score || a.resort.name.localeCompare(b.resort.name));
}

export interface RangeMatch {
  range: SkiRange;
  fit: number;
  tone: Tone;
  resorts: ResortMatch[];
  /** Things to do across its resorts in the window that fit them. */
  forThemCount: number;
  score: number;
  verdict: string;
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthSpan(months: readonly number[]): string {
  if (!months.length) return '';
  return months.length === 1 ? MONTH[months[0] - 1] : `${MONTH[months[0] - 1]} to ${MONTH[months[months.length - 1] - 1]}`;
}

export function rankRanges(
  ranges: readonly SkiRange[],
  resorts: readonly SkiResort[],
  scene: readonly SceneItem[],
  window: TripWindow,
  weights: Weights,
): RangeMatch[] {
  const months = monthWeights(window.from, window.to);
  return ranges
    .map((range) => {
      const fit = snowFit(months, range.bestMonths, (month) => range.seasonMonths.includes(month));
      const ranked = rankResorts(resorts.filter((resort) => resort.rangeId === range.id), scene, window, weights);
      const top = ranked.slice(0, 3).reduce((sum, match) => sum + match.score, 0) / 3;
      const forThemCount = ranked.reduce((sum, match) => sum + match.forThem.length, 0);
      const tone = toneFor(fit);
      const verdict = tone === 'good'
        ? `Best snow of the year for your dates`
        : tone === 'season'
          ? `Open, best ${monthSpan(range.bestMonths)}`
          : `Their season is ${monthSpan(range.seasonMonths)}`;
      return { range, fit, tone, resorts: ranked, forThemCount, score: fit * 100 + top, verdict };
    })
    .sort((a, b) => b.score - a.score || a.range.name.localeCompare(b.range.name));
}

// ── The best week ───────────────────────────────────────────────────────────

export interface WeekMatch extends Week {
  score: number;
  label: string;
  /** Dated things on that week, best first. */
  events: SceneItem[];
  crowd: string | null;
  reasons: string[];
}

/** Every possible week in the window for one resort, best first. */
export function rankWeeks(resort: SkiResort, scene: readonly SceneItem[], window: TripWindow, weights: Weights): WeekMatch[] {
  const items = scene.filter((item) => item.resortId === resort.id);
  const open = (month: number) => inSeason(month, resort.season.opensMonth, resort.season.closesMonth);
  const announced = resort.season.dates;
  return candidateWeeks(window)
    .map((week) => {
      const months = monthWeights(week.start, week.end);
      let fit = snowFit(months, resort.bestMonths, open);
      // Outside the announced season, the lifts are shut whatever the month.
      if (announced && (week.end < announced.open || (announced.close && week.start > announced.close))) fit = 0;
      const events = items
        .filter((item) => item.dates && overlaps(item.dates.start, item.dates.end, week.start, week.end))
        .sort((a, b) => itemPoints(b, weights) - itemPoints(a, weights));
      const year = Number(week.start.slice(0, 4));
      const crowd = [...crowdWeeks(year, resort.countryCode), ...crowdWeeks(year + 1, resort.countryCode)]
        .find((span) => overlaps(span.start, span.end, week.start, week.end))?.label ?? null;
      const peak = [...months.keys()].some((month) => resort.peakMonths.includes(month));
      const reasons: string[] = [];
      if (fit >= 0.75) reasons.push('Prime snow');
      else if (fit === 0) reasons.push('Lifts closed');
      for (const event of events.slice(0, 3)) reasons.push(`${event.name} is on`);
      if (crowd) reasons.push(`${crowd}: busiest and priciest`);
      else if (peak && fit > 0) reasons.push('Peak season');
      const score = fit * 40 + events.reduce((sum, event) => sum + itemPoints(event, weights) * 2, 0) - (crowd ? 6 : 0);
      return { ...week, score, label: formatSpan(week.start, week.end), events, crowd, reasons };
    })
    .sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
}
