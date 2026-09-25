import { scoreEvent } from '@/lib/buzz/scoring';
import { daysBetween } from '@/lib/buzz/dates';
import { matchesTripType } from '@/lib/discovery/recommend';
import { inWheres, type Where } from '@/lib/geo/regions';
import type { TripType } from '@/lib/jev/contracts/feedItem';
import type { WorldEvent } from '@/lib/types';
import { kmBetween, placeForEvent, type Place } from './places';
import type { TripWindow } from './window';

export type VibeSource = { label: string; url?: string; date?: string };
export type VibeReason = { kind: 'event' | 'news' | 'taste' | 'caveat'; text: string; points: number; sources: VibeSource[] };
export type Mention = { title: string; url: string; source: string; tier: 'A' | 'B' | 'C'; publishedAt: string };
export type EventEvidence = { id: string; name: string; tagline: string; category: string; tags: string[]; start: string; end: string; overlapDays: number; season: boolean };

export type VibePlace = {
  key: string;
  /** Destination page slug, when the calendar has one for this place. */
  slug?: string | null;
  name: string;
  country: string;
  kind: Place['kind'];
  events: EventEvidence[];
  /** The newest few, for reasons and for matching the traveler's artists. */
  mentions: Mention[];
  mentionCount: number;
  sourceCount: number;
  /** Points by component; they add up to `points`. Taste is added on the device. */
  components: { calendar: number; news: number; prior: number };
  points: number;
  reasons: VibeReason[];
};

export type NewsStatus = { state: 'ok' | 'empty' | 'unavailable'; since: string | null; stories: number };

export type VibeMatchInput = {
  wheres: readonly Where[];
  tripType: TripType | null;
  window: TripWindow;
  today: string;
  events: readonly WorldEvent[];
  places: readonly Place[];
  /** Mentions per place key from the news index, or null when the news signal is unavailable. */
  mentions: ReadonlyMap<string, readonly Mention[]> | null;
  news: NewsStatus;
  limit?: number;
};

export type VibeMatchResult = {
  places: VibePlace[];
  /** In range, but nothing dated or counted about them yet: listed, not ranked. */
  alsoInRange: { key: string; name: string; country: string }[];
  news: NewsStatus;
};

// Fixed constants: a place's score never depends on which other places were loaded.
export const WEIGHTS = { calendar: 35, news: 25, prior: 10, taste: 30 } as const;
const TIER_WEIGHT: Record<WorldEvent['tier'], number> = { legendary: 1, marquee: 0.7, insider: 0.5 };
const SOURCE_WEIGHT: Record<Mention['tier'], number> = { A: 1, B: 0.7, C: 0.4 };
const NEWS_SATURATION = 12;
const SEASON_DAYS = 21;

const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const round1 = (value: number) => Math.round(value * 10) / 10;
/** "Feb 7–8", "Jan 30 – Feb 2", or one day. */
const range = (a: string, b: string) => (a === b ? short(a) : a.slice(0, 7) === b.slice(0, 7) ? `${short(a)}–${Number(b.slice(8, 10))}` : `${short(a)} – ${short(b)}`);
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`}`;

function alpineResorts(places: readonly Place[]) {
  return places.filter((place) => place.kind === 'resort' && place.country !== 'Japan');
}

/** Inside what they named. "The Alps" means resorts and places within 40 km of one, not all of seven countries. */
function inScope(place: Place, wheres: readonly Where[], alpine: readonly Place[]): boolean {
  if (!wheres.length) return true;
  return wheres.some((where) => {
    if (!inWheres(place.country, [where])) return false;
    if (where.label !== 'the Alps') return true;
    return place.kind === 'resort' || alpine.some((resort) => kmBetween(place, resort) <= 40);
  });
}

/**
 * Vibe Match, server half: which places are worth your window, from what we
 * can count. Calendar events overlapping the exact dates, stories that name
 * the place, and the calendar's editorial buzz (a small, labeled prior). The
 * traveler's taste is added on the device (see affinity.ts), so the profile
 * never leaves it. Every reason carries its source.
 */
export function vibeMatch(input: VibeMatchInput): VibeMatchResult {
  const { wheres, tripType, window, today, events, places, mentions } = input;
  const alpine = alpineResorts(places);

  // Events in the window, attached to their place.
  const eventsAt = new Map<string, { event: WorldEvent; overlap: number; fit: boolean }[]>();
  for (const event of events) {
    if (event.end < window.from || event.start > window.to) continue;
    const place = placeForEvent(event, places);
    if (!place) continue;
    const overlap = daysBetween(event.start > window.from ? event.start : window.from, event.end < window.to ? event.end : window.to) + 1;
    const list = eventsAt.get(place.key) ?? [];
    list.push({ event, overlap, fit: matchesTripType(event, tripType) });
    eventsAt.set(place.key, list);
  }

  const skiLike = tripType === 'ski';
  const candidates: Place[] = [];
  for (const place of places) {
    if (!inScope(place, wheres, alpine)) continue;
    const here = eventsAt.get(place.key) ?? [];
    const counted = mentions?.get(place.key) ?? [];
    const sources = new Set(counted.map((mention) => mention.source)).size;
    if (skiLike) {
      if (place.kind === 'resort' || here.some((entry) => entry.fit)) candidates.push(place);
    } else if (here.some((entry) => entry.fit) || (!tripType && sources >= 2)) {
      candidates.push(place);
    }
  }

  const ranked: VibePlace[] = [];
  const alsoInRange: VibeMatchResult['alsoInRange'] = [];
  for (const place of candidates.slice(0, 200)) {
    // Every event there that week counts: the kind asked for in full, anything else (a wine
    // festival at a ski resort) at half, since that's the find nobody would put together.
    const here = eventsAt.get(place.key) ?? [];
    let calendarRaw = 0;
    let prior = 0;
    const eventReasons: VibeReason[] = [];
    for (const { event, overlap, fit } of here) {
      const eventDays = daysBetween(event.start, event.end) + 1;
      const season = eventDays > SEASON_DAYS;
      const share = overlap / Math.max(1, Math.min(window.days, eventDays));
      const contribution = TIER_WEIGHT[event.tier] * (fit ? 1 : 0.5) * share * (season ? 0.5 : 1);
      calendarRaw += contribution;
      prior = Math.max(prior, scoreEvent(event, { now: today }).score / 100);
      const when = season ? `season runs ${range(event.start, event.end)}` : window.exact ? `overlaps your dates, ${range(event.start > window.from ? event.start : window.from, event.end < window.to ? event.end : window.to)}` : range(event.start, event.end);
      eventReasons.push({ kind: 'event', text: `${event.name}: ${when}`, points: contribution, sources: [{ label: 'dope.travel calendar' }] });
    }
    const calendar = 1 - Math.exp(-calendarRaw);

    // News: counted stories naming the place, newest first, at most two per source.
    const counted = [...(mentions?.get(place.key) ?? [])].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const perSource = new Map<string, number>();
    let newsRaw = 0;
    const kept: Mention[] = [];
    for (const mention of counted) {
      const n = perSource.get(mention.source) ?? 0;
      if (n >= 2) continue;
      perSource.set(mention.source, n + 1);
      kept.push(mention);
      const age = Math.max(0, daysBetween(mention.publishedAt.slice(0, 10), today));
      newsRaw += SOURCE_WEIGHT[mention.tier] * 0.5 ** (age / 7);
    }
    const news = Math.min(1, Math.log(1 + newsRaw) / Math.log(1 + NEWS_SATURATION));
    const sourceCount = perSource.size;

    const components = { calendar: round1(WEIGHTS.calendar * calendar), news: round1(WEIGHTS.news * news), prior: round1(WEIGHTS.prior * prior) };
    const points = round1(components.calendar + components.news + components.prior);
    if (points === 0 && !here.length && !kept.length) {
      alsoInRange.push({ key: place.key, name: place.name, country: place.country });
      continue;
    }

    const reasons: VibeReason[] = eventReasons
      .sort((a, b) => b.points - a.points)
      .slice(0, 2)
      .map((reason) => ({ ...reason, points: round1(WEIGHTS.calendar * reason.points) }));
    if (kept.length) {
      const since = input.news.since ? ` since ${short(input.news.since.slice(0, 10))}` : '';
      reasons.push({
        kind: 'news',
        text: `Named in ${plural(kept.length, 'story')} from ${plural(sourceCount, 'source')}${since}`,
        points: components.news,
        sources: kept.slice(0, 3).map((mention) => ({ label: mention.source, url: mention.url, date: mention.publishedAt.slice(0, 10) })),
      });
    }
    if (!here.length) reasons.push({ kind: 'caveat', text: 'No dated events in our calendar for your dates', points: 0, sources: [{ label: 'dope.travel calendar' }] });

    ranked.push({
      key: place.key,
      name: place.name,
      country: place.country,
      kind: place.kind,
      events: here.map(({ event, overlap }) => ({ id: event.id, name: event.name, tagline: event.tagline, category: event.category, tags: event.tags.slice(0, 12), start: event.start, end: event.end, overlapDays: overlap, season: daysBetween(event.start, event.end) + 1 > SEASON_DAYS })),
      mentions: kept.slice(0, 8),
      mentionCount: kept.length,
      sourceCount,
      components,
      points,
      reasons,
    });
  }

  ranked.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  alsoInRange.sort((a, b) => a.name.localeCompare(b.name));
  return { places: ranked.slice(0, input.limit ?? 8), alsoInRange: alsoInRange.slice(0, 60), news: input.news };
}
