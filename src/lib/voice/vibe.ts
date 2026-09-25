import { planPlaceFromQuery, planTripHref, type PlanPlace } from '@/lib/search/planPlace';
import type { VoiceIntent, VoiceToolName } from './tools';

/** Where a page-owned tool lives, so the header's Vibe can open it first. */
export type VibeTarget = { intent: Exclude<VoiceIntent, 'vibe' | 'general'>; href: string };

const TRIP_TOOLS = new Set<VoiceToolName>(['add_traveler', 'remove_traveler', 'create_trip']);

export function vibeTarget(tool: VoiceToolName, args: Record<string, unknown>): VibeTarget | null {
  if (tool === 'describe_me') return { intent: 'board', href: '/moodboard' };
  if (tool === 'set_now_city') return { intent: 'now', href: '/now' };
  if (tool === 'set_trip_basics') {
    const place = typeof args.place === 'string' ? planPlaceFromQuery(args.place) : null;
    // A place opens the designer's setup form even when a trip is in progress.
    return { intent: 'trip', href: place ? planTripHref(place) : '/trips/designer' };
  }
  if (TRIP_TOOLS.has(tool)) return { intent: 'trip', href: '/trips/designer' };
  return null;
}

const ABOUT_ME = /\b(?:i'?m|i am|i love|i like|i live|i grew up|i root|i listen|i travel|my|we love)\b/i;
const TRIP_LEAD = /^\s*(?:(?:i|we)\s+(?:want|wanna|would like|'d like)\s+to\s+go\s+to|let'?s\s+go\s+to|(?:a\s+)?trip\s+to|going\s+to|take\s+(?:me|us)\s+to|to)\s+/i;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_WORD = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// Where the place ends in speech, which has no commas: "Lisbon second week of October me and Sam".
const TRIP_BREAK = new RegExp(`\\s+(?:in|on|for|with|from|next|this|around|during|over|at|first|second|third|fourth|last|early|mid|late|me|us|and|no|not|but|then|${MONTH_WORD})\\b`, 'i');
const VAGUE = /^\s*(?:somewhere|anywhere|someplace|something|nowhere)\b/i;
// "where's the best surf town", "best ski spot right now": questions and asks, never places.
const ASKING = /^\s*(?:where|what|which|who|how|when|why|whats|what's|where's|wheres|is|are|can|could|should|would|do|does|best|top|most|hottest|greatest|recommend|suggest|surprise|plan|take|need|want|wanna|let'?s|help|book|get|go|going|just|maybe|find|show|tell|give|any|some|i|i'm|im|we|hmm+|um+|uh+|ok(?:ay)?|so|well|the)\b/i;

const NOT_A_PLACE = new RegExp(`^(?:${MONTH_WORD}|monday|tuesday|wednesday|thursday|friday|saturday|sunday|christmas|easter|thanksgiving|i|i'm|im|me|we|us)$`, 'i');

function leadPlace(lead: string): PlanPlace | null {
  if (!lead.trim() || VAGUE.test(lead) || ASKING.test(lead)) return null;
  if (lead.trim().split(/\s+/).some((word) => NOT_A_PLACE.test(word.replace(/[.,!?]/g, '')))) return null;
  return planPlaceFromQuery(lead) ?? planPlaceFromQuery(lead.split(',')[0] ?? '');
}

/** One to three Capitalized words, as speech-to-text writes a place name. */
function capitalizedRun(words: string[]): PlanPlace | null {
  for (let size = Math.min(3, words.length); size >= 1; size--) {
    const run = words.slice(0, size);
    if (!run.every((word) => /^\p{Lu}/u.test(word))) continue;
    const place = leadPlace(run.join(' '));
    if (place) return place;
  }
  return null;
}

/** The place a trip request starts with: "Lisbon, second week of October, me and Sam" → Lisbon. */
export function placeFromTypedTrip(text: string): PlanPlace | null {
  const stripped = text.replace(TRIP_LEAD, '');
  if (ASKING.test(stripped) || VAGUE.test(stripped)) return null;
  const lead = stripped.split(TRIP_BREAK)[0] ?? '';
  const found = leadPlace(lead);
  if (found) return found;
  return capitalizedRun(stripped.split(/[\s,]+/).filter(Boolean));
}

/** "…skiing in Verbier in February" → Verbier: a Capitalized place after in/to/at, anywhere in the text. */
export function placeAfterPreposition(text: string): PlanPlace | null {
  const re = /\b(?:in|to|at|visit|visiting|around)\s+((?:\p{Lu}[\p{L}’'.-]+)(?:\s+\p{Lu}[\p{L}’'.-]+){0,2})/gu;
  for (const match of text.matchAll(re)) {
    const words = match[1]!.split(/\s+/);
    for (let size = words.length; size >= 1; size--) {
      const place = leadPlace(words.slice(0, size).join(' '));
      if (place) return place;
    }
  }
  return null;
}

/**
 * The place in a request that may have grown by answering a follow-up:
 * "…no touristy fado. Lisbon" still finds Lisbon at the end.
 */
export function placeFromTripRequest(text: string): PlanPlace | null {
  const first = placeFromTypedTrip(text);
  if (first) return first;
  const words = text.replace(/[.!?]+\s*$/, '').split(/[\s,.!?]+/).filter(Boolean);
  for (let size = Math.min(3, words.length); size >= 1; size--) {
    const tail = words.slice(-size);
    if (!tail.every((word) => /^\p{Lu}/u.test(word))) continue;
    const place = leadPlace(tail.join(' '));
    if (place) return place;
  }
  return null;
}

const COUNT: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, couple: 2, few: 3 };
const WEEK_OF: Record<string, number> = { first: 1, '1st': 1, early: 1, second: 8, '2nd': 8, mid: 12, middle: 12, third: 15, '3rd': 15, fourth: 22, '4th': 22, last: 22, late: 22, end: 22 };

function iso(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate())));
  return date.toISOString().slice(0, 10);
}

export type TripWhen = { start?: string; nights?: number; month?: { from: string; to: string } };

/**
 * When and how long, from plain words: "second week of October", "a week in
 * February", "10 days", "the weekend of March 14". Only what was said; nothing
 * is guessed when no month or length is named.
 */
const monthWeek = new RegExp(`\\b(?:first|1st|second|2nd|third|3rd|fourth|4th|last)\\s+week\\b`);

export function tripWhen(text: string, today: string): TripWhen {
  const lower = text.toLowerCase();
  const out: TripWhen = {};
  const monthMatch = new RegExp(`\\b(?:(first|1st|second|2nd|third|3rd|fourth|4th|last|early|mid|middle|late|end)\\b[\\w\\s-]{0,12}?\\s)?(?:of\\s)?(${MONTH_WORD})\\b(?:\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b)?`, 'i').exec(lower);
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_WORD})\\b`, 'i').exec(lower);
  if (monthMatch || dayFirst) {
    const word = (dayFirst?.[2] ?? monthMatch![2])!.slice(0, 3);
    const month = MONTHS.findIndex((name) => name.startsWith(word));
    const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
    const explicitDay = Number(dayFirst?.[1] ?? monthMatch?.[3] ?? 0);
    const day = explicitDay >= 1 && explicitDay <= 31 ? explicitDay : WEEK_OF[monthMatch?.[1] ?? ''] ?? 1;
    let year = ty;
    if (month + 1 < tm || (month + 1 === tm && day < td)) year += 1;
    out.start = iso(year, month, day);
    out.month = { from: iso(year, month, 1), to: iso(year, month, 31) };
    if (out.start < today) out.start = today;
  }
  const length = /\b(\d{1,2}|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|couple(?: of)?|few)\s+(nights?|days?|weeks?)\b/.exec(lower);
  if (length) {
    const raw = length[1]!.replace(' of', '');
    const n = /^\d+$/.test(raw) ? Number(raw) : COUNT[raw] ?? 1;
    const unit = length[2]!;
    const nights = unit.startsWith('week') ? n * 7 : unit.startsWith('day') ? Math.max(1, n - 1) : n;
    out.nights = Math.max(1, Math.min(30, nights));
  } else if (monthWeek.test(lower)) {
    // "the first week of February" is a week away.
    out.nights = 7;
  } else if (/\b(?:long\s+)?weekend\b/.test(lower)) {
    out.nights = /\blong\s+weekend\b/.test(lower) ? 3 : 2;
  }
  return out;
}

export type TypedVibe = { kind: 'profile' } | { kind: 'trip'; place: PlanPlace | null };

/**
 * What typed text means when voice is off: talk about yourself builds the
 * profile; a place starts a trip. With no profile yet, anything that isn't
 * clearly a trip goes to the profile.
 */
export function readTypedVibe(text: string, hasProfile: boolean): TypedVibe {
  if (ABOUT_ME.test(text)) return { kind: 'profile' };
  const place = placeFromTypedTrip(text);
  if (place) return { kind: 'trip', place };
  return hasProfile ? { kind: 'trip', place: null } : { kind: 'profile' };
}

const NUMBER_WORD: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1, couple: 2 };
const toNumber = (word: string) => (/^\d+$/.test(word) ? Number(word) : NUMBER_WORD[word.toLowerCase()] ?? 0);
const CREW_COUNT = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

export type TripCrew = { people: number; label: string };

/**
 * How many are going, from plain words: "my family of four and another family
 * of four" is 8, "me and my wife" is 2, "two couples" is 4, "solo" is 1.
 * Null when they didn't say.
 */
export function tripCrew(text: string): TripCrew | null {
  const lower = text.toLowerCase();
  const families = [...lower.matchAll(new RegExp(`famil(?:y|ies) of ${CREW_COUNT}`, 'g'))].map((match) => toNumber(match[1]!));
  if (families.length) {
    const people = families.reduce((sum, n) => sum + n, 0);
    const same = families.every((n) => n === families[0]);
    const label = families.length === 1 ? `a family of ${families[0]}` : same ? `${families.length} families of ${families[0]}` : `${families.length} families`;
    return { people, label: `${label} (${people} people)` };
  }
  const couples = new RegExp(`${CREW_COUNT} couples`).exec(lower);
  if (couples) {
    const people = toNumber(couples[1]!) * 2;
    return { people, label: `${couples[1]} couples (${people} people)` };
  }
  const group = new RegExp(`\\b${CREW_COUNT} (?:of us|people|adults|friends|guys|girls|travell?ers)\\b`).exec(lower);
  if (group) {
    const n = toNumber(group[1]!);
    const people = /friends/.test(group[0]) && !/of us/.test(group[0]) ? n + 1 : n;
    return { people, label: `${people} people` };
  }
  if (/\b(solo|by myself|just me|alone)\b/.test(lower)) return { people: 1, label: 'just you' };
  if (/\b(me and (?:my )?\w+|my (?:wife|husband|partner|girlfriend|boyfriend)|the two of us|a couple)\b/.test(lower)) return { people: 2, label: '2 people' };
  return null;
}
