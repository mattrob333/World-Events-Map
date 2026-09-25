import type { CanvasSpot, SpotKind } from '@/lib/voice/canvas';
import type { DesignerCard, SlotKind } from './catalog';
import type { Itinerary } from './itinerary';

/**
 * What they tapped on the Vibe canvas, carried into the trip designer: each
 * pick becomes an idea card that leads a matching time block. Picks keep
 * their source link; nothing here is a booking.
 */

const KEY = 'dope-vibe-picks';

export type VibePicks = { place: string; spots: CanvasSpot[] };

/** Which time blocks a kind of spot belongs in, best first. */
const SLOTS_FOR: Record<SpotKind, SlotKind[]> = {
  eat: ['dinner', 'lunch'],
  drink: ['late', 'apres'],
  apres: ['apres', 'late'],
  dance: ['late'],
  do: ['afternoon', 'morning'],
  event: ['afternoon', 'dinner', 'late', 'morning'],
  stay: [],
};

const EMOJI: Record<SpotKind, string> = { eat: '🍽️', drink: '🍸', apres: '🥂', dance: '🪩', do: '✨', event: '🎟️', stay: '🛏️' };
const PALETTE: Record<SpotKind, [string, string]> = {
  eat: ['#6b3a1f', '#e0a15a'], drink: ['#2a1d3a', '#b0578d'], apres: ['#1e3a5f', '#f2c14e'], dance: ['#1a1030', '#e4577e'],
  do: ['#1f3d34', '#8fc1a9'], event: ['#3a1f1f', '#f7c548'], stay: ['#2b2b2b', '#a8a598'],
};

export function saveVibePicks(picks: VibePicks): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(picks));
  } catch {
    // Private mode or storage off: the trip still builds, without the picks.
  }
}

/** Read once: the designer takes them for the next trip it builds. */
export function takeVibePicks(): VibePicks | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as VibePicks) : null;
    return parsed && typeof parsed.place === 'string' && Array.isArray(parsed.spots) ? parsed : null;
  } catch {
    return null;
  }
}

export function pickCard(spot: CanvasSpot): DesignerCard {
  return {
    id: `vibe-${spot.id.replace(/[^a-z0-9-]+/g, '-')}`.slice(0, 90),
    destination: 'custom',
    slots: SLOTS_FOR[spot.kind].length ? SLOTS_FOR[spot.kind] : ['afternoon'],
    title: spot.name,
    blurb: spot.why || `Found on ${spot.host}.`,
    media: 'poster',
    palette: PALETTE[spot.kind],
    emoji: EMOJI[spot.kind],
    tags: ['vibe-pick', spot.kind],
    link: { href: spot.url, label: `Where we found it · ${spot.host}` },
  };
}

/**
 * Puts each pick at the front of the first free matching block, day by day
 * (an event on its date when it falls inside the trip). Picks with no
 * matching block ride along in the card pool. Returns a new itinerary.
 */
export function pinPicks(trip: Itinerary, spots: readonly CanvasSpot[]): Itinerary {
  if (!spots.length) return trip;
  const cards = spots.map(pickCard);
  const days = trip.days.map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, cardIds: [...slot.cardIds] })) }));
  const taken = new Set<string>();
  spots.forEach((spot, index) => {
    const card = cards[index]!;
    const wanted = SLOTS_FOR[spot.kind];
    const dated = spot.date ? days.filter((day) => day.date === spot.date) : [];
    const order = dated.length ? dated : days;
    for (const kind of wanted) {
      const slot = order.flatMap((day) => day.slots).find((candidate) => candidate.kind === kind && !taken.has(candidate.id));
      if (!slot) continue;
      taken.add(slot.id);
      slot.cardIds = [card.id, ...slot.cardIds.filter((id) => id !== card.id)];
      return;
    }
  });
  const existing = new Set((trip.cards ?? []).map((card) => card.id));
  return { ...trip, cards: [...(trip.cards ?? []), ...cards.filter((card) => !existing.has(card.id))], days };
}
