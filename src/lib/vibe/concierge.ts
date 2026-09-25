import type { Signal, VibeDials } from './signals';
import { vocabFor } from './signals';

/**
 * The concierge's matcher: a traveler's signals against what we know about a
 * spot (its description, category, hours, how busy it gets, how much it's
 * being talked about). Rules first, so it's instant and free; Jev can then
 * weigh the best few (vibe-fit@1). The wink line only states facts we hold:
 * never an invented detail.
 */

export type CandidateFacts = {
  id: string;
  name: string;
  kind: 'eat' | 'drink' | 'dance' | 'apres' | 'do' | 'event' | 'stay' | 'place';
  /** Name, description, category: whatever words we have about it. */
  text: string;
  date?: string;
  /** Closing time that night in minutes after midnight; past midnight runs over 1440 (2am = 1560). */
  closesAt?: number;
  /** "Busiest 11pm–1am" from BestTime, when connected. */
  busiest?: string;
  /** Stories or posts naming it in the last few weeks. */
  mentions?: number;
  rating?: number;
  ratingCount?: number;
  /** A dated occasion the place is known for (a home match, a festival). */
  signature?: boolean;
};

export type MatchHit = { key: string; label: string; strength: 'love' | 'like' };
export type Match = {
  score: number;
  hits: MatchHit[];
  conflicts: { key: string; label: string }[];
  /** One line in the concierge's voice, from facts only. Null when nothing says it better than the description. */
  wink: string | null;
  /** Worth nudging them toward even though it isn't their usual. */
  stretch: boolean;
};

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const has = (hay: string, needle: string) => Boolean(needle) && ` ${hay} `.includes(` ${needle} `);

/** "2am", "11:30pm". */
export function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${min ? `:${String(min).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

const LATE = 25 * 60; // 1am
const NIGHT_KINDS = new Set<CandidateFacts['kind']>(['drink', 'dance', 'apres']);

function hitFor(signal: Signal, facts: CandidateFacts, text: string): boolean {
  if (signal.key === 'nights:last-call') return (facts.closesAt ?? 0) >= LATE || Boolean(vocabFor(signal.key)?.venue?.test(facts.text));
  const vocab = vocabFor(signal.key);
  if (vocab) return Boolean(vocab.venue?.test(facts.text));
  // Named: an artist, team, genre or cuisine appears in what we know about it.
  return has(text, fold(signal.label));
}

function winkFor(best: MatchHit | undefined, facts: CandidateFacts, stretch: boolean): string | null {
  if (best?.key === 'nights:last-call' && facts.closesAt && facts.closesAt >= LATE) return `Pours till ${clock(facts.closesAt)}. Last ones out, as usual.`;
  if (best?.key.startsWith('sports:team:')) return `${best.label}. You’ll want to be in the building.`;
  if (best?.key.startsWith('music:artist:')) return `${best.label} on the bill.`;
  if (best?.key.startsWith('music:genre:')) return `Your sound: ${best.label.toLowerCase()}.`;
  if (best?.key === 'nights:dance') return 'The dance floor’s the point here.';
  if (best?.key === 'nights:cocktail-bar') return 'Serious cocktails, your kind of bar.';
  if (best?.key === 'nights:speakeasy') return 'Hidden door. You’ll like it.';
  if (best?.key === 'nights:live-music') return 'Live music on. Your kind of night.';
  if (best?.key === 'culture:comedy') return 'Stand-up, and you’re in the mood to laugh.';
  if (best) return best.strength === 'love' ? `Right in your lane: ${best.label.toLowerCase()}.` : `Hits your ${best.label.toLowerCase()} side.`;
  if (stretch && facts.signature) return 'Not your usual, but it’s the night the whole town talks about.';
  if (stretch && (facts.mentions ?? 0) >= 3) return 'Everyone’s talking about it this week.';
  return null;
}

/**
 * Scores one spot for one traveler (0–100). Loves count most, avoids knock it
 * right down, a late close counts for someone who shuts the bar down, and a
 * signature moment or real buzz can lift something outside their usual taste,
 * as far as their stretch dial allows.
 */
export function matchCandidate(signals: readonly Signal[], dials: VibeDials | undefined, facts: CandidateFacts): Match {
  const text = fold(`${facts.name} ${facts.text}`);
  const hits: MatchHit[] = [];
  const conflicts: Match['conflicts'] = [];
  let score = 20;
  for (const signal of signals) {
    if (!hitFor(signal, facts, text)) continue;
    if (signal.strength === 'avoid') {
      conflicts.push({ key: signal.key, label: signal.label });
      score -= 45;
      continue;
    }
    const named = /:(artist|team):/.test(signal.key);
    score += signal.strength === 'love' ? (named ? 40 : 26) : named ? 24 : 14;
    hits.push({ key: signal.key, label: signal.label, strength: signal.strength });
  }
  // Someone who shuts the bar down doesn't want a bar that closes at 11.
  if (signals.some((s) => s.key === 'nights:last-call' && s.strength !== 'avoid') && NIGHT_KINDS.has(facts.kind) && facts.closesAt !== undefined && facts.closesAt < 23 * 60 + 30) score -= 12;
  if ((facts.rating ?? 0) >= 4.5 && (facts.ratingCount ?? 0) >= 200) score += 5;
  const buzz = Math.min(15, (facts.mentions ?? 0) * 3);
  score += buzz;
  const stretchRoom = (dials?.stretch ?? 2) * 5;
  const stretch = !hits.length && !conflicts.length && (Boolean(facts.signature) || buzz >= 9) && stretchRoom > 0;
  if (facts.signature) score += 10;
  if (stretch) score += stretchRoom;
  hits.sort((a, b) => Number(b.strength === 'love') - Number(a.strength === 'love') || Number(/:(artist|team):/.test(b.key)) - Number(/:(artist|team):/.test(a.key)));
  return { score: Math.max(0, Math.min(100, Math.round(score))), hits, conflicts, wink: conflicts.length ? null : winkFor(hits[0], facts, stretch), stretch };
}
