/**
 * Trip ideas built around what a traveler loves: find the cities and short
 * windows where their artists, festivals, and teams line up, and favor the
 * ones that also overlap a curated occasion (a "cool location" signal from
 * the editorial calendar). Pure and deterministic; the events come from real
 * providers and the occasions from the curated data.
 */

import type { EventSource, LiveEvent } from './concerts';

export type Occasion = { id: string; name: string; city: string; countryCode: string; start: string; end: string; lat: number; lon: number; href?: string };

export type TripIdea = {
  key: string;
  city: string;
  country?: string;
  lat?: number;
  lon?: number;
  start: string;
  end: string;
  nights: number;
  score: number;
  events: LiveEvent[];
  occasions: Pick<Occasion, 'id' | 'name' | 'start' | 'end' | 'href'>[];
  /** One line on why, built only from the events and occasions listed. */
  why: string;
};

const WEIGHT: Record<LiveEvent['kind'], number> = { festival: 5, artist: 4, game: 3, tribute: 1.5, scene: 1 };
const DAY = 86_400_000;

function days(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

function eventScore(event: LiveEvent): number {
  const base = WEIGHT[event.kind] + (event.kind === 'game' && event.away ? 1 : 0);
  return event.fit !== undefined ? base * (0.4 + event.fit) : base;
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function cityKey(event: LiveEvent): string | null {
  // Providers disagree on country codes, so group on the city name alone.
  return event.city ? event.city.trim().toLowerCase() : null;
}

function describe(events: LiveEvent[], occasions: TripIdea['occasions']): string {
  const parts: string[] = [];
  const festivals = events.filter((e) => e.kind === 'festival');
  const shows = events.filter((e) => e.kind === 'artist');
  const games = events.filter((e) => e.kind === 'game');
  const tributes = events.filter((e) => e.kind === 'tribute');
  if (festivals.length) parts.push(`${festivals[0].name} with ${festivals[0].artist ?? 'your artists'} on the bill`);
  if (shows.length) parts.push(`${[...new Set(shows.map((e) => e.artist))].slice(0, 2).join(' and ')} live`);
  if (games.length) parts.push(`${games[0].team}${games[0].away ? ' on the road' : ''}`);
  if (tributes.length && parts.length < 2) parts.push(`a ${tributes[0].artist ?? 'tribute'} tribute night`);
  if (occasions.length) parts.push(`during ${occasions[0].name}`);
  return parts.length ? `${parts.join(', ')}.` : 'Live music on your dates.';
}

/**
 * Groups events by city, then slides a window (default up to 4 nights) to
 * find each city's best stretch. Returns the top ideas, best first.
 */
export function rankTripIdeas(
  events: LiveEvent[],
  options: { occasions?: Occasion[]; maxNights?: number; limit?: number; excludeCity?: string } = {},
): TripIdea[] {
  const maxNights = Math.min(Math.max(options.maxNights ?? 4, 1), 10);
  const exclude = options.excludeCity?.split(',')[0].trim().toLowerCase();
  const byCity = new Map<string, LiveEvent[]>();
  for (const event of events) {
    const key = cityKey(event);
    if (!key || (exclude && event.city?.toLowerCase() === exclude)) continue;
    byCity.set(key, [...(byCity.get(key) ?? []), event]);
  }

  const ideas: TripIdea[] = [];
  for (const [key, list] of byCity) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let best: { start: number; end: number; score: number } | null = null;
    for (let i = 0; i < sorted.length; i += 1) {
      let score = 0;
      let j = i;
      while (j < sorted.length && days(sorted[i].date, sorted[j].date) <= maxNights) {
        score += eventScore(sorted[j]);
        j += 1;
      }
      // Several different things in one stretch beats one big thing.
      const kinds = new Set(sorted.slice(i, j).map((e) => e.kind)).size;
      score *= 1 + (kinds - 1) * 0.15;
      if (!best || score > best.score) best = { start: i, end: j, score };
    }
    if (!best) continue;
    const picked = sorted.slice(best.start, best.end);
    const first = picked[0];
    const last = picked[picked.length - 1];
    const start = addDays(first.date, -1);
    const end = addDays(last.date, 1);
    const withCoords = picked.find((e) => e.lat !== undefined && e.lon !== undefined);
    const occasions = (options.occasions ?? [])
      .filter((o) => o.start <= end && o.end >= start)
      .filter((o) =>
        o.city.toLowerCase() === first.city?.toLowerCase() ||
        (withCoords && haversineKm(withCoords.lat!, withCoords.lon!, o.lat, o.lon) < 60),
      )
      .map(({ id, name, start: s, end: e, href }) => ({ id, name, start: s, end: e, href }));
    const score = Math.round((best.score + occasions.length * 2.5) * 10) / 10;
    ideas.push({
      key,
      city: first.city!,
      country: picked.find((e) => e.country)?.country,
      lat: withCoords?.lat,
      lon: withCoords?.lon,
      start,
      end,
      nights: days(start, end),
      score,
      events: picked,
      occasions,
      why: describe(picked, occasions),
    });
  }
  return ideas.sort((a, b) => b.score - a.score || a.start.localeCompare(b.start)).slice(0, options.limit ?? 10);
}

export type TripIdeasResponse = { sources: EventSource[]; ideas: TripIdea[]; fetchedAt: string };
