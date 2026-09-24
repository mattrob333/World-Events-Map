import {
  CARD_INDEX,
  DESTINATION_INDEX,
  SLOT_META,
  cardsFor,
  type DesignerCard,
  type DesignerDestination,
  type DestinationId,
  type DestinationKind,
  type SlotKind,
} from './catalog';
import { cityAirport } from './airports';
import { customDestination, placeCards, type PlaceSpec } from './place';
import type { TasteInput } from './scene';

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

export type TripDestination = DestinationId | 'custom';

export type Itinerary = {
  id: string;
  destination: TripDestination;
  /** Set when the trip is to a typed-in place rather than a curated destination. */
  place?: PlaceSpec;
  /** Search-backed idea cards generated for a typed-in place. */
  cards?: DesignerCard[];
  startDate: string;
  nights: number;
  hometown?: string;
  participants: Participant[];
  days: Day[];
  engine: ComposeEngine;
  createdAt: string;
  /** Group music taste from the travelers' boards; attached on the device, never sent to the composer. */
  taste?: TasteInput;
  /** Set on a friend's copy opened from a share link: who shared it. */
  joinedFrom?: string;
};

export type ComposeInput = {
  destination: TripDestination;
  place?: PlaceSpec;
  startDate: string;
  nights: number;
  hometown?: string;
  participants: Participant[];
  /** Favorite foods, used only for typed-in places. */
  foods?: string[];
  /** Group music taste, used only for typed-in places (composed on the device). */
  taste?: TasteInput;
};

/** The destination a trip points at, curated or typed-in. */
export function resolveDestination(trip: Pick<Itinerary, 'destination' | 'place'>): DesignerDestination | undefined {
  if (trip.destination === 'custom') return trip.place ? customDestination(trip.place) : undefined;
  return DESTINATION_INDEX.get(trip.destination);
}

/**
 * Trips saved before the live-music card was renamed still carry its old
 * title, which promised tonight's shows that a Maps search can't know.
 */
function retitle(card: DesignerCard): DesignerCard {
  const old = /^Live music tonight in (.+)$/.exec(card.title);
  if (!old || card.destination !== 'custom') return card;
  return { ...card, title: `Find a live-music bar in ${old[1]}`, blurb: 'A Maps search for bars that usually have a band. Check their page for tonight.' };
}

/** Looks up a card by id, including a typed-in place's generated cards. */
export function cardLookup(trip: Pick<Itinerary, 'cards'> | null | undefined): (id: string) => DesignerCard | undefined {
  const extra = new Map((trip?.cards ?? []).map((card) => [card.id, retitle(card)]));
  return (id) => extra.get(id) ?? CARD_INDEX.get(id);
}

export const MAX_NIGHTS = 14;
export const MAX_PARTICIPANTS = 10;
const MAX_CANDIDATES = 8;

const PARTICIPANT_COLORS = ['#f97316', '#06b6d4', '#a855f7', '#22c55e', '#ec4899', '#eab308', '#3b82f6', '#ef4444', '#14b8a6', '#8b5cf6'];
const PARTICIPANT_EMOJI = ['😎', '🌺', '🏂', '⚾', '🎧', '🦊', '🐬', '🌶️', '🎨', '🚀'];

export function participantStyle(index: number) {
  return { color: PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length], emoji: PARTICIPANT_EMOJI[index % PARTICIPANT_EMOJI.length] };
}

/**
 * The first style whose color and emoji nobody on the trip has yet, so two
 * people added at the same position (two friends named Priya) never look alike.
 */
export function nextParticipantStyle(participants: Pick<Participant, 'color' | 'emoji'>[]) {
  const colors = new Set(participants.map((p) => p.color.toLowerCase()));
  const emoji = new Set(participants.map((p) => p.emoji));
  for (let i = 0; i < PARTICIPANT_COLORS.length; i += 1) {
    const style = participantStyle(participants.length + i);
    if (!colors.has(style.color) && !emoji.has(style.emoji)) return style;
  }
  const color = PARTICIPANT_COLORS.find((c) => !colors.has(c)) ?? participantStyle(participants.length).color;
  const face = PARTICIPANT_EMOJI.find((e) => !emoji.has(e)) ?? participantStyle(participants.length).emoji;
  return { color, emoji: face };
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

function dayShape(index: number, lastIndex: number, tags: string[], kind: DestinationKind): SlotKind[] {
  const wantsLate = tags.includes('nightlife') || tags.includes('music') || !tags.includes('kids');
  if (index === 0) return ['depart', 'flight', 'arrive', 'dinner'];
  if (index === lastIndex) return ['morning', 'lunch', 'depart', 'flight'];
  // Après is a ski ritual; city and beach days go straight from afternoon to dinner.
  const middle: SlotKind[] = kind === 'ski' ? ['morning', 'lunch', 'afternoon', 'apres', 'dinner'] : ['morning', 'lunch', 'afternoon', 'dinner'];
  if (wantsLate || kind !== 'ski') middle.push('late');
  return middle;
}

/**
 * Rough airport positions (lat, lon) for the hometowns and places the
 * composer knows, used only to tell a short hop from a long haul.
 */
const AIRPORT_COORDS: Record<string, [number, number]> = {
  ATL: [33.64, -84.43], JFK: [40.64, -73.78], LAX: [33.94, -118.41], ORD: [41.98, -87.9], MIA: [25.79, -80.29], DFW: [32.9, -97.04],
  IAH: [29.99, -95.34], BOS: [42.36, -71.01], SFO: [37.62, -122.38], SEA: [47.45, -122.31], DEN: [39.86, -104.67], IAD: [38.95, -77.46],
  PHL: [39.87, -75.24], CLT: [35.21, -80.94], BNA: [36.12, -86.68], AUS: [30.19, -97.67], PHX: [33.43, -112.01], MCO: [28.43, -81.31],
  LAS: [36.08, -115.15], MSY: [29.99, -90.26], ASE: [39.22, -106.87], EGE: [39.64, -106.92], SLC: [40.79, -111.98], JAC: [43.61, -110.74],
  SAN: [32.73, -117.19], PDX: [45.59, -122.6], STL: [38.75, -90.37], MCI: [39.3, -94.71], DTW: [42.21, -83.35], MSP: [44.88, -93.22],
  SAV: [32.13, -81.2], CHS: [32.9, -80.04], EYW: [24.56, -81.76], HNL: [21.32, -157.92], OGG: [20.9, -156.43], YYZ: [43.68, -79.63],
  YUL: [45.47, -73.74], YVR: [49.19, -123.18], MEX: [19.44, -99.07], CUN: [21.04, -86.87], SJD: [23.15, -109.72], PVR: [20.68, -105.25],
  SJU: [18.44, -66.0], HAV: [22.99, -82.41], GRU: [-23.43, -46.47], GIG: [-22.81, -43.25], EZE: [-34.82, -58.54], LIM: [-12.02, -77.11],
  CTG: [10.44, -75.51], MDE: [6.16, -75.42], LHR: [51.47, -0.45], CDG: [49.01, 2.55], LIS: [38.77, -9.13], OPO: [41.24, -8.68],
  MAD: [40.49, -3.57], BCN: [41.3, 2.08], SVQ: [37.42, -5.89], AGP: [36.67, -4.5], IBZ: [38.87, 1.37], PMI: [39.55, 2.73],
  FCO: [41.8, 12.25], MXP: [45.63, 8.72], FLR: [43.81, 11.2], VCE: [45.51, 12.35], NAP: [40.88, 14.29], AMS: [52.31, 4.76],
  BER: [52.36, 13.5], MUC: [48.35, 11.79], VIE: [48.11, 16.57], PRG: [50.1, 14.26], BUD: [47.44, 19.26], CPH: [55.62, 12.65],
  ARN: [59.65, 17.92], OSL: [60.19, 11.1], KEF: [63.99, -22.61], DUB: [53.42, -6.27], EDI: [55.95, -3.37], NCE: [43.66, 7.21],
  ZRH: [47.46, 8.55], GVA: [46.24, 6.11], ATH: [37.94, 23.94], JTR: [36.4, 25.48], JMK: [37.44, 25.35], IST: [41.26, 28.74],
  DBV: [42.56, 18.27], SPU: [43.54, 16.3], RAK: [31.61, -8.04], CPT: [-33.97, 18.6], NBO: [-1.32, 36.93], CAI: [30.12, 31.41],
  DXB: [25.25, 55.36], HND: [35.55, 139.78], KIX: [34.43, 135.24], ICN: [37.46, 126.44], BKK: [13.69, 100.75], DPS: [-8.75, 115.17],
  SIN: [1.36, 103.99], HKG: [22.31, 113.92], SYD: [-33.94, 151.18], MEL: [-37.67, 144.84], AKL: [-37.01, 174.79], CTS: [42.78, 141.69],
  MLE: [4.19, 73.53],
};

/** Airports you can't drive to from a mainland (islands and sea crossings). */
const OFFSHORE = new Set(['HNL', 'OGG', 'SJU', 'HAV', 'KEF', 'IBZ', 'PMI', 'JTR', 'JMK', 'DUB', 'MLE', 'DPS', 'AKL', 'CTS', 'SIN', 'HKG']);

const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho',
  'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota',
  'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina',
  'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
  'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming',
];

function usState(text: string): string | undefined {
  const lower = text.toLowerCase();
  return [...US_STATES].sort((a, b) => b.length - a.length).find((state) => new RegExp(`\\b${state}\\b`).test(lower));
}

function greatCircleKm([aLat, aLon]: [number, number], [bLat, bLon]: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** drive: close and on the same landmass · short: a quick flight · medium: a few hours · long: long haul. */
export type TripHop = 'drive' | 'short' | 'medium' | 'long' | 'unknown';

/**
 * How far the trip is, from airport positions when both ends are known, else
 * from the hometown and region text (same state = drivable, both in the US =
 * domestic). Coarse on purpose: it only decides which travel-day ideas fit.
 */
export function tripHop(input: Pick<ComposeInput, 'destination' | 'place' | 'hometown'>): { hop: TripHop; km?: number } {
  if (!input.hometown) return { hop: 'unknown' };
  const destination = resolveDestination(input);
  const from = homeAirport(input.hometown) ?? cityAirport(input.hometown);
  const to = destination?.gateway.iata || (input.place ? cityAirport(input.place.name) : undefined);
  if (from && to && AIRPORT_COORDS[from] && AIRPORT_COORDS[to]) {
    const km = Math.round(greatCircleKm(AIRPORT_COORDS[from], AIRPORT_COORDS[to]) / 10) * 10;
    if (km < 600 && !OFFSHORE.has(from) && !OFFSHORE.has(to)) return { hop: 'drive', km };
    if (km < 1200) return { hop: 'short', km };
    if (km < 3500) return { hop: 'medium', km };
    return { hop: 'long', km };
  }
  const homeState = usState(input.hometown);
  const placeText = input.place ? `${input.place.name} ${input.place.region ?? ''}` : destination ? `${destination.name} ${destination.region}` : '';
  const placeState = usState(placeText);
  if (homeState && placeState && homeState === placeState && !['hawaii', 'alaska'].includes(homeState)) return { hop: 'drive' };
  if (homeState && (placeState || /\b(usa|united states)\b/i.test(placeText))) return { hop: 'medium' };
  return { hop: 'unknown' };
}

/** Travel-day ideas that don't fit the distance: no red-eye or lounge for a short hop, driving only when it's close. */
export function travelCardFits(card: Pick<DesignerCard, 'id'>, hop: TripHop): boolean {
  if (card.id === 'any:overnight-flight') return hop === 'long' || hop === 'unknown';
  if (card.id === 'any:lounge') return hop !== 'drive' && hop !== 'short';
  if (card.id === 'any:drive' || card.id === 'any:load-car') return hop === 'drive';
  return true;
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
  // A bar with nothing for the kids is never the family's late-night pick when something else fits.
  if (slot === 'late' && tags.includes('kids') && card.tags.includes('nightlife') && !card.tags.includes('music') && !card.tags.includes('kids')) score -= 3;
  return score;
}

export function candidatesFor(destination: TripDestination, slot: SlotKind, tags: string[], extra: DesignerCard[] = [], hop: TripHop = 'unknown'): DesignerCard[] {
  const driveFirst = (card: DesignerCard) => (hop === 'drive' && (card.id === 'any:drive' || card.id === 'any:load-car') ? 10 : 0);
  return [...extra, ...cardsFor(destination)]
    .filter((card) => card.slots.includes(slot) && travelCardFits(card, hop))
    .map((card) => ({ card, score: scoreCard(card, tags, slot) + driveFirst(card) }))
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))
    .map(({ card }) => card);
}

function travelNote(input: ComposeInput, slot: SlotKind, dayIndex: number, lastIndex: number, hop: { hop: TripHop; km?: number } = { hop: 'unknown' }): string | undefined {
  const destination = resolveDestination(input);
  if (!destination) return undefined;
  const home = homeAirport(input.hometown);
  const homeLabel = input.hometown ? `${input.hometown}${home ? ` (${home})` : ''}` : 'home';
  if (hop.hop === 'drive') {
    const distance = hop.km ? `About ${hop.km.toLocaleString('en-US')} km as the crow flies` : 'Close';
    if (dayIndex === 0 && slot === 'depart') return `Leave ${input.hometown ?? 'home'}: drive, or head to the airport.`;
    if (dayIndex === 0 && slot === 'flight') return `${input.hometown?.split(',')[0] ?? 'Home'} → ${destination.name}. ${distance}: close enough to drive or take a short flight. Route idea, not a fare.`;
    if (dayIndex === lastIndex && slot === 'depart') return 'Pack up and check out.';
    if (dayIndex === lastIndex && slot === 'flight') return `${destination.name} → ${input.hometown?.split(',')[0] ?? 'home'}: drive back, or take a short flight.`;
  }
  if (dayIndex === 0 && slot === 'depart') return `Leave ${homeLabel} for the airport.`;
  if (!destination.gateway.iata) {
    if (dayIndex === 0 && slot === 'flight') return `${home ?? 'Your airport'} → ${destination.name}. Route idea, not a fare.`;
    if (dayIndex === 0 && slot === 'arrive') return `Land near ${destination.name}, then head to your stay.`;
    if (dayIndex === lastIndex && slot === 'depart') return 'Transfer back to the airport.';
    if (dayIndex === lastIndex && slot === 'flight') return `${destination.name} → ${home ?? 'home'}. Route idea, not a fare.`;
    return undefined;
  }
  if (dayIndex === 0 && slot === 'flight') return `${home ?? 'Your airport'} → ${destination.gateway.iata}. Route idea, not a fare.`;
  if (dayIndex === 0 && slot === 'arrive') return `${destination.gateway.airport} (${destination.gateway.iata}), then ${destination.gateway.onward}.`;
  if (dayIndex === lastIndex && slot === 'depart') return `Transfer back to ${destination.gateway.airport} (${destination.gateway.iata}).`;
  if (dayIndex === lastIndex && slot === 'flight') return `${destination.gateway.iata} → ${home ?? 'home'}. Route idea, not a fare.`;
  return undefined;
}

const SLOT_TITLES: Partial<Record<SlotKind, string>> = { depart: 'Head to the airport', flight: 'Fly home' };
const DRIVE_TITLES: Partial<Record<SlotKind, string>> = { depart: 'Check out', flight: 'Head home' };

function slotLabel(kind: SlotKind, dayIndex: number, lastIndex: number, hop: TripHop = 'unknown'): string {
  if (dayIndex === lastIndex) {
    const titles = hop === 'drive' ? DRIVE_TITLES : SLOT_TITLES;
    if (titles[kind]) return titles[kind]!;
  }
  if (dayIndex === 0 && kind === 'flight' && hop === 'drive') return 'Getting there';
  return SLOT_META[kind].label;
}

/** The time shown on a slot. The return transfer happens after lunch, not "Early". */
function slotTime(kind: SlotKind, dayIndex: number, lastIndex: number): string {
  if (dayIndex === lastIndex && dayIndex > 0 && kind === 'depart') return 'Afternoon';
  return SLOT_META[kind].time;
}

function hypeFor(day: Day, lookup: (id: string) => DesignerCard | undefined): { title: string; hype: string } {
  const leads = day.slots
    .map((slot) => lookup(slot.cardIds[0]))
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
  const destination = resolveDestination(input);
  if (!destination) throw new Error('Choose a destination or type where you’re going.');
  const nights = Math.min(Math.max(1, Math.round(input.nights)), MAX_NIGHTS);
  const tags = groupTags(input.participants);
  const cards = input.destination === 'custom' && input.place ? placeCards(input.place, { tags, foods: input.foods, taste: input.taste }) : undefined;
  const lookup = cardLookup({ cards });
  const lastIndex = nights;
  const usedLeads = new Set<string>();
  const hop = tripHop(input);

  const days: Day[] = Array.from({ length: nights + 1 }, (_, index) => {
    const slots = dayShape(index, lastIndex, tags, destination.kind).map((kind) => {
      const ranked = candidatesFor(input.destination, kind, tags, cards, hop.hop);
      const fresh = ranked.findIndex((card) => !usedLeads.has(card.id) && card.destination !== 'any');
      const leadIndex = fresh >= 0 && kind !== 'depart' && kind !== 'flight' ? fresh : 0;
      const ordered = ranked.length ? [ranked[leadIndex], ...ranked.filter((_, i) => i !== leadIndex)] : [];
      if (ordered[0]) usedLeads.add(ordered[0].id);
      return {
        id: `d${index}-${kind}`,
        kind,
        label: slotLabel(kind, index, lastIndex, hop.hop),
        time: slotTime(kind, index, lastIndex),
        cardIds: ordered.slice(0, MAX_CANDIDATES).map((card) => card.id),
        note: travelNote(input, kind, index, lastIndex, hop),
      } satisfies Slot;
    });
    const day: Day = { index, date: addDays(input.startDate, index), title: '', hype: '', slots };
    return { ...day, ...hypeFor(day, lookup) };
  });

  return {
    id: `trip-${now.getTime().toString(36)}`,
    destination: input.destination,
    ...(input.destination === 'custom' ? { place: input.place, cards } : {}),
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
  const hop = tripHop(base).hop;
  const days = base.days.map((day) => {
    const curated = curation.days.find((entry) => entry.index === day.index);
    if (!curated) return day;
    const slots = day.slots.map((slot) => {
      const pick = curated.slots.find((entry) => entry.id === slot.id);
      if (!pick) return slot;
      const pool = candidatesFor(base.destination, slot.kind, tags, base.cards, hop).map((card) => card.id);
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
