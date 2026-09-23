import {
  CARD_INDEX,
  DESTINATION_INDEX,
  SLOT_META,
  cardsFor,
  type DesignerCard,
  type DestinationId,
  type SlotKind,
} from './catalog';

export type ParticipantKind = 'adult' | 'kid';

export type Participant = {
  id: string;
  name: string;
  kind: ParticipantKind;
  age?: number;
  emoji: string;
  color: string;
  /** Planning signals (from a mood board or quick picks). */
  tags: string[];
};

export type Slot = {
  id: string;
  kind: SlotKind;
  label: string;
  time: string;
  /** Ordered idea cards; the first is the current pick. */
  cardIds: string[];
  note?: string;
};

export type Day = {
  index: number;
  date: string;
  title: string;
  hype: string;
  slots: Slot[];
};

export type ComposeEngine = 'claude' | 'on-device';

export type Itinerary = {
  id: string;
  destination: DestinationId;
  startDate: string;
  nights: number;
  hometown?: string;
  participants: Participant[];
  days: Day[];
  engine: ComposeEngine;
  createdAt: string;
};

export type ComposeInput = {
  destination: DestinationId;
  startDate: string;
  nights: number;
  hometown?: string;
  participants: Participant[];
};

export const MAX_NIGHTS = 14;
export const MAX_PARTICIPANTS = 10;
const MAX_CANDIDATES = 8;

const PARTICIPANT_COLORS = ['#f97316', '#06b6d4', '#a855f7', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444', '#14b8a6', '#8b5cf6'];
const PARTICIPANT_EMOJI = ['😎', '🌺', '🏂', '⚾', '🎧', '🦊', '🐬', '🌶️', '🎨', '🚀'];

export function participantStyle(index: number) {
  return { color: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length], emoji: PARTICIPANT_EMOJI[index % PARTICIPANT_EMOJI.length] };
}

const HOME_AIRPORTS: Record<string, string> = {
  atlanta: 'ATL', 'new york': 'JFK', brooklyn: 'JFK', manhattan: 'JFK', 'los angeles': 'LAX', chicago: 'ORD',
  miami: 'MIA', dallas: 'DFW', houston: 'IAH', boston: 'BOS', 'san francisco': 'SFO', seattle: 'SEA', denver: 'DEN',
  washington: 'IAD', philadelphia: 'PHL', charlotte: 'CLT', nashville: 'BNA', austin: 'AUS', phoenix: 'PHX',
  orlando: 'MCO', london: 'LHR', paris: 'CDG', 'são paulo': 'GRU', 'sao paulo': 'GRU', 'rio de janeiro': 'GIG',
  toronto: 'YYZ', 'mexico city': 'MEX', dubai: 'DXB', singapore: 'SIN', sydney: 'SYD',
};

export function homeAirport(hometown?: string): string | undefined {
  if (!hometown) return undefined;
  const lower = hometown.toLowerCase();
  const hit = Object.keys(HOME_AIRPORTS).find((city) => lower.includes(city));
  return hit ? HOME_AIRPORTS[hit] : undefined;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function groupTags(participants: Participant[]): string[] {
  const tags = new Set<string>();
  for (const person of participants) {
    for (const tag of person.tags) tags.add(tag);
    if (person.kind === 'kid') {
      tags.add('kids');
      tags.add((person.age ?? 10) <= 9 ? 'little-kids' : 'big-kids');
    }
  }
  return [...tags];
}

function dayShape(index: number, lastIndex: number, tags: string[], kind: 'ski' | 'beach'): SlotKind[] {
  const wantsLate = tags.includes('nightlife') || tags.includes('music') || !tags.includes('kids');
  if (index === 0) return ['depart', 'flight', 'arrive', 'dinner'];
  if (index === lastIndex) return ['morning', 'lunch', 'depart', 'flight'];
  const middle: SlotKind[] = ['morning', 'lunch', 'afternoon', 'apres', 'dinner'];
  if (wantsLate || kind === 'beach') middle.push('late');
  return middle;
}

/** Scores an idea card for a group. Higher is a better fit. */
export function scoreCard(card: DesignerCard, tags: string[], slot: SlotKind): number {
  let score = 0;
  for (const tag of card.tags) if (tags.includes(tag)) score += tag === 'kids' || tag === 'little-kids' ? 2 : 1.5;
  if (card.destination !== 'any') score += 1.2;
  if (card.image) score += 0.4;
  const littleKids = tags.includes('little-kids');
  if (littleKids && card.tags.includes('nightlife') && slot !== 'late') score -= 2;
  if (littleKids && card.tags.includes('active') && !card.tags.includes('kids')) score -= 1;
  if (slot === 'late' && tags.includes('kids') && !tags.includes('nightlife') && card.tags.includes('nightlife')) score -= 1.5;
  return score;
}

export function candidatesFor(destination: DestinationId, slot: SlotKind, tags: string[]): DesignerCard[] {
  return cardsFor(destination)
    .filter((card) => card.slots.includes(slot))
    .map((card) => ({ card, score: scoreCard(card, tags, slot) }))
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))
    .map(({ card }) => card);
}

function travelNote(input: ComposeInput, slot: SlotKind, dayIndex: number, lastIndex: number): string | undefined {
  const destination = DESTINATION_INDEX.get(input.destination);
  if (!destination) return undefined;
  const home = homeAirport(input.hometown);
  const homeLabel = input.hometown ? `${input.hometown}${home ? ` (${home})` : ''}` : 'home';
  if (dayIndex === 0 && slot === 'depart') return `Leave ${homeLabel} for the airport.`;
  if (dayIndex === 0 && slot === 'flight') return `${home ?? 'Your airport'} → ${destination.gateway.iata}. Route idea, not a fare.`;
  if (dayIndex === 0 && slot === 'arrive') return `${destination.gateway.airport} (${destination.gateway.iata}), then ${destination.gateway.onward}.`;
  if (dayIndex === lastIndex && slot === 'depart') return `Transfer back to ${destination.gateway.airport} (${destination.gateway.iata}).`;
  if (dayIndex === lastIndex && slot === 'flight') return `${destination.gateway.iata} → ${home ?? 'home'}. Route idea, not a fare.`;
  return undefined;
}

const SLOT_TITLES: Partial<Record<SlotKind, string>> = { depart: 'Head to the airport', flight: 'Fly home' };

function slotLabel(kind: SlotKind, dayIndex: number, lastIndex: number): string {
  if (dayIndex === lastIndex && SLOT_TITLES[kind]) return SLOT_TITLES[kind]!;
  return SLOT_META[kind].label;
}

function hypeFor(day: Day): { title: string; hype: string } {
  const leads = day.slots
    .map((slot) => CARD_INDEX.get(slot.cardIds[0]))
    .filter((card): card is DesignerCard => Boolean(card && card.destination !== 'any'));
  if (!leads.length) return { title: day.index === 0 ? 'Wheels up' : 'Travel day', hype: 'The trip starts the moment you lock the front door.' };
  const title = leads.slice(0, 2).map((card) => card.emoji).join(' ') + ' ' + leads[0].title.split(/[,:]/)[0];
  const hype = leads.slice(0, 3).map((card) => card.title).join(' → ');
  return { title, hype };
}

/**
 * Builds the timeline skeleton (days × time slots) and fills each slot with
 * ranked idea cards. Deterministic, so the canvas works without any AI.
 */
export function composeLocally(input: ComposeInput, now = new Date()): Itinerary {
  const destination = DESTINATION_INDEX.get(input.destination);
  if (!destination) throw new Error('Choose a destination from the list.');
  const nights = Math.min(Math.max(1, Math.round(input.nights)), MAX_NIGHTS);
  const tags = groupTags(input.participants);
  const lastIndex = nights;
  const usedLeads = new Set<string>();

  const days: Day[] = Array.from({ length: nights + 1 }, (_, index) => {
    const slots = dayShape(index, lastIndex, tags, destination.kind).map((kind) => {
      const ranked = candidatesFor(input.destination, kind, tags);
      const fresh = ranked.findIndex((card) => !usedLeads.has(card.id) && card.destination !== 'any');
      const leadIndex = fresh >= 0 && kind !== 'depart' && kind !== 'flight' ? fresh : 0;
      const ordered = ranked.length ? [ranked[leadIndex], ...ranked.filter((_, i) => i !== leadIndex)] : [];
      if (ordered[0]) usedLeads.add(ordered[0].id);
      return {
        id: `d${index}-${kind}`,
        kind,
        label: slotLabel(kind, index, lastIndex),
        time: SLOT_META[kind].time,
        cardIds: ordered.slice(0, MAX_CANDIDATES).map((card) => card.id),
        note: travelNote(input, kind, index, lastIndex),
      } satisfies Slot;
    });
    const day: Day = { index, date: addDays(input.startDate, index), title: '', hype: '', slots };
    return { ...day, ...hypeFor(day) };
  });

  return {
    id: `trip-${now.getTime().toString(36)}`,
    destination: input.destination,
    startDate: input.startDate,
    nights,
    hometown: input.hometown,
    participants: input.participants,
    days,
    engine: 'on-device',
    createdAt: now.toISOString(),
  };
}

export type Curation = {
  days: { index: number; title?: string; hype?: string; slots: { id: string; cardIds: string[]; note?: string }[] }[];
};

/**
 * Applies an AI curation to a locally composed itinerary. Only card ids that
 * already belong to the slot's candidate pool survive, so the AI can reorder
 * and explain ideas but never invent a venue.
 */
export function applyCuration(base: Itinerary, curation: Curation, tags: string[]): Itinerary {
  const days = base.days.map((day) => {
    const curated = curation.days.find((entry) => entry.index === day.index);
    if (!curated) return day;
    const slots = day.slots.map((slot) => {
      const pick = curated.slots.find((entry) => entry.id === slot.id);
      if (!pick) return slot;
      const pool = candidatesFor(base.destination, slot.kind, tags).map((card) => card.id);
      const allowed = new Set(pool);
      const chosen = [...new Set(pick.cardIds.filter((id) => allowed.has(id)))];
      if (!chosen.length) return slot;
      const rest = slot.cardIds.filter((id) => !chosen.includes(id));
      const note = slot.note ?? (pick.note ? pick.note.slice(0, 160) : undefined);
      return { ...slot, cardIds: [...chosen, ...rest].slice(0, MAX_CANDIDATES), note };
    });
    return {
      ...day,
      title: curated.title?.slice(0, 60) || day.title,
      hype: curated.hype?.slice(0, 200) || day.hype,
      slots,
    };
  });
  return { ...base, days, engine: 'claude' };
}

export function daysUntil(startDate: string, today = new Date()): number {
  const start = Date.UTC(Number(startDate.slice(0, 4)), Number(startDate.slice(5, 7)) - 1, Number(startDate.slice(8, 10)));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start - now) / 86_400_000);
}
