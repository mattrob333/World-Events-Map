/**
 * Vibe Now's ranking, on the device: how busy each place is against the
 * energy they asked for, whether it stays open late, and how well it fits
 * their Vibe profile. Pure, so the rules are tested apart from the UI.
 */
import { matchCandidate, type CandidateFacts } from '@/lib/vibe/concierge';
import type { Signal, VibeDials } from '@/lib/vibe/signals';
import { closesLabel, type PulseVenue } from './pulse';

export type NowEnergy = 'chill' | 'social' | 'lively' | 'surprise';

export type NowPick = PulseVenue & {
  score: number;
  closes: string | null;
  /** The concierge's line from facts, when there is one ("Pours till 3am…"). */
  wink: string | null;
  why: string[];
};

function kindFor(category: string): CandidateFacts['kind'] {
  const c = category.toUpperCase();
  if (/CLUB|NIGHT/.test(c)) return 'dance';
  if (/BAR|PUB|BREW|WINE|LOUNGE|COCKTAIL/.test(c)) return 'drink';
  if (/RESTAURANT|CAFE|FOOD|BAKERY|PIZZA/.test(c)) return 'eat';
  return 'do';
}

/** How well a busyness reading fits the energy they asked for, 0–1. */
export function energyFit(busyness: number, energy: NowEnergy): number {
  const b = Math.max(0, Math.min(100, busyness));
  if (energy === 'lively') return b / 100;
  if (energy === 'chill') return Math.max(0, 1 - Math.abs(b - 30) / 60);
  if (energy === 'social') return Math.max(0, 1 - Math.abs(b - 60) / 50);
  return 0.5 + b / 200;
}

/**
 * Best first. `nowMinutes` is minutes after midnight where they are; with
 * `late`, places that close within the hour drop off and ones open past
 * midnight rise.
 */
export function rankNowPicks(
  venues: readonly PulseVenue[],
  options: { energy: NowEnergy; late?: boolean; nowMinutes: number; signals?: readonly Signal[]; dials?: VibeDials; limit?: number },
): NowPick[] {
  const { energy, late = false, nowMinutes, signals = [], dials, limit = 5 } = options;
  // Before 5am, "now" belongs to last night: 1am is 1500 on the closing-time clock.
  const clock = nowMinutes < 300 ? nowMinutes + 1440 : nowMinutes;
  const picks: NowPick[] = [];
  for (const venue of venues) {
    if (late && venue.closesMinutes !== undefined && venue.closesMinutes - clock < 60) continue;
    const fit = energyFit(venue.busyness, energy);
    const lateBonus = late ? (venue.closesMinutes === undefined ? 0 : venue.closesMinutes >= 1440 + 60 ? 0.25 : venue.closesMinutes >= 1440 ? 0.15 : 0) : 0;
    const match = signals.length ? matchCandidate(signals, dials, { id: venue.id, name: venue.name, kind: kindFor(venue.category), text: venue.category.toLowerCase().replace(/_/g, ' '), closesAt: venue.closesMinutes }) : null;
    const taste = match ? match.score / 100 : 0.5;
    const near = venue.distanceMeters === undefined ? 0.5 : Math.max(0, 1 - venue.distanceMeters / 5000);
    const score = 0.45 * fit + 0.25 * taste + 0.15 * near + lateBonus + (match?.conflicts.length ? -0.3 : 0);
    const closes = closesLabel(venue.closesMinutes);
    const why = [
      venue.basis === 'live' ? `${venue.busyness}% busy right now` : `usually ${venue.busyness}% busy this hour`,
      closes ?? '',
    ].filter(Boolean);
    picks.push({ ...venue, score: Math.round(score * 100) / 100, closes, wink: match?.wink ?? null, why });
  }
  return picks.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** One line for the concierge: the top picks, facts only. */
export function picksSummary(picks: readonly NowPick[], place: string): string {
  if (!picks.length) return `Nothing open with a foot-traffic reading near ${place} right now. Say so plainly and offer to widen it.`;
  return `On their screen, near ${place}: ${picks.map((pick, i) => `${i + 1}. ${pick.name} (${pick.category.toLowerCase().replace(/_/g, ' ')}; ${pick.why.join('; ')}${pick.distanceMeters !== undefined ? `; ${(pick.distanceMeters / 1609).toFixed(1)} mi` : ''})`).join(' ')}.`;
}
