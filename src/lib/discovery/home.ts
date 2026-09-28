import { vocabFor, type Signal } from '@/lib/vibe/signals';
import type { WorldEvent } from '@/lib/types';

/**
 * Home: what's on in your own country over the next few months, and which of
 * it fits your Vibe profile. From the curated calendar only: no paid lookups.
 * Pure.
 */
export const HOME_DAYS = 120;

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Events in a country still to come or on now, starting within `days` of today, soonest first. */
export function homeEvents<T extends WorldEvent>(events: readonly T[], countryCode: string, today: string, days = HOME_DAYS): T[] {
  const last = addDays(today, days);
  return events
    .filter((event) => event.countryCode === countryCode && event.end >= today && event.start <= last)
    .sort((a, b) => a.start.localeCompare(b.start));
}

const GROUP_CATEGORIES: Record<string, readonly string[]> = {
  music: ['music'],
  sports: ['motorsport', 'sailing', 'golf', 'tennis', 'equestrian', 'ski'],
  food: ['culinary'],
  culture: ['art', 'film', 'design', 'cultural', 'fashion'],
};

/**
 * Why an event fits them, in their own profile's words: a named artist or
 * team on the bill, or a scene they love. Null when nothing in the profile
 * points at it (it's still shown, just not called out).
 */
export function forYou(event: WorldEvent, signals: readonly Signal[]): string | null {
  const text = fold([event.name, event.tagline, event.city, ...(event.tags ?? []), ...(event.venues ?? [])].join(' '));
  const categories = [event.category, ...(event.secondaryCategories ?? [])] as string[];
  const liked = signals.filter((signal) => signal.strength !== 'avoid');
  // A named artist, team or thing on the bill beats a broad taste.
  for (const signal of liked) {
    const parts = signal.key.split(':');
    if (parts.length >= 3) {
      const name = fold(signal.label);
      if (name.length >= 3 && ` ${text} `.includes(` ${name} `)) return signal.label;
    }
  }
  for (const signal of liked) {
    const entry = vocabFor(signal.key);
    if (entry?.venue?.test(text) || entry?.words.test(text)) return signal.label;
  }
  // A broad love ("sports", "live music") covers its whole scene. A named team,
  // artist or genre doesn't: loving the Braves says nothing about the X Games.
  for (const signal of liked.filter((entry) => entry.strength === 'love' && entry.key.split(':').length < 3)) {
    const group = signal.key.split(':')[0];
    if (GROUP_CATEGORIES[group]?.some((category) => categories.includes(category))) return signal.label;
  }
  return null;
}
