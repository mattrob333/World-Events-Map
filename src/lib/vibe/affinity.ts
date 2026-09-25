import type { TravelerProfile } from '@/lib/designer/profile';
import type { VibePlace, VibeReason } from './match';
import { fold } from './places';

export type RankedVibePlace = VibePlace & { taste: number; total: number; personalized: boolean };

type TermKind = 'artist' | 'team' | 'food' | 'genre' | 'interest';
type Term = { needle: string; label: string; kind: TermKind };

/** Same as WEIGHTS.taste in match.ts; kept here so the device doesn't load the server scorer. */
const TASTE_WEIGHT = 30;
const HIT: Record<TermKind, number> = { artist: 0.8, team: 0.8, food: 0.6, genre: 0.4, interest: 0.3 };
const ARTIST_IN_STORY = 0.5;

const round1 = (value: number) => Math.round(value * 10) / 10;
const has = (haystack: string, needle: string) => ` ${haystack} `.includes(` ${needle} `);

/** A name is safe to match when it's long or several words ("Yes" and "Train" aren't). */
function usable(name: string, kind: TermKind): boolean {
  const folded = fold(name);
  if (folded.length < 3) return false;
  return kind !== 'artist' || folded.includes(' ') || folded.length >= 4;
}

function termsOf(profile: TravelerProfile): Term[] {
  const out: Term[] = [];
  const add = (values: readonly string[] | undefined, kind: TermKind) => {
    for (const value of values ?? []) if (usable(value, kind)) out.push({ needle: fold(value), label: value, kind });
  };
  add(profile.artists, 'artist');
  add(profile.teams, 'team');
  add(profile.food, 'food');
  add(profile.music, 'genre');
  add(profile.interests, 'interest');
  add(profile.events, 'interest');
  return out;
}

/**
 * Vibe Match, device half: what in each place matches the traveler, from
 * their own profile, which never leaves this device. A match is quoted, not
 * inferred: "Your artist Fred again.. · White Turf". Taste can be up to 30 of
 * the 100 points; anything on their avoid list halves it and says so.
 */
export function withTaste(places: readonly VibePlace[], profile: TravelerProfile | undefined): RankedVibePlace[] {
  const terms = profile ? termsOf(profile) : [];
  const avoid = (profile?.style?.avoid ?? []).map(fold).filter((term) => term.length >= 3);
  const ranked = places.map((place): RankedVibePlace => {
    const best = new Map<string, { h: number; reason: VibeReason }>();
    const note = (key: string, h: number, reason: VibeReason) => {
      const current = best.get(key);
      if (!current || h > current.h) best.set(key, { h, reason });
    };
    let avoided: string | null = null;
    for (const event of place.events) {
      const text = fold(`${event.name} ${event.tagline} ${event.tags.join(' ')} ${event.category}`);
      for (const term of terms) {
        if (!has(text, term.needle)) continue;
        if (term.kind === 'genre' && event.category !== 'music') continue;
        const text2 = term.kind === 'artist' ? `Your artist ${term.label}: ${event.name}`
          : term.kind === 'team' ? `Your team ${term.label}: ${event.name}`
          : `Matches your ${term.label}: ${event.name}`;
        note(`${term.kind}:${term.needle}`, HIT[term.kind], { kind: 'taste', text: text2, points: 0, sources: [{ label: 'dope.travel calendar' }] });
      }
      avoided ??= avoid.find((term) => has(text, term)) ?? null;
    }
    for (const mention of place.mentions) {
      const text = fold(mention.title);
      for (const term of terms) {
        if (term.kind !== 'artist' || !has(text, term.needle)) continue;
        note(`story:${term.needle}`, ARTIST_IN_STORY, { kind: 'taste', text: `${term.label} and ${place.name} in the same story`, points: 0, sources: [{ label: mention.source, url: mention.url, date: mention.publishedAt.slice(0, 10) }] });
      }
    }
    const hits = [...best.values()].sort((a, b) => b.h - a.h);
    let affinity = 1 - hits.reduce((keep, hit) => keep * (1 - hit.h), 1);
    const reasons = [...place.reasons];
    if (avoided) {
      affinity *= 0.5;
      reasons.push({ kind: 'caveat', text: `Includes something you'd rather skip (${avoided})`, points: 0, sources: [{ label: 'Your profile' }] });
    }
    const taste = round1(TASTE_WEIGHT * affinity);
    const tasteReasons = hits.slice(0, 2).map((hit) => ({ ...hit.reason, points: round1(TASTE_WEIGHT * hit.h) }));
    return { ...place, taste, total: round1(place.points + taste), personalized: Boolean(profile), reasons: [...tasteReasons, ...reasons] };
  });
  return ranked.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
