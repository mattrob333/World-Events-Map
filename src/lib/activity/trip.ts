import type { DesignerCard, SlotKind } from '@/lib/designer/catalog';
import type { Itinerary } from '@/lib/designer/itinerary';
import { CATEGORY_META, type Activity, type Category } from './activities';

/**
 * A spot from the globe, carried into the open trip: an idea card at the
 * front of the first free block that suits it (an event on its dates when
 * they fall inside the trip). Nothing here is a booking.
 */
const SLOTS: Record<Category, SlotKind[]> = {
  ski: ['morning', 'afternoon'],
  surf: ['morning', 'afternoon'],
  beach: ['afternoon', 'morning'],
  festival: ['afternoon', 'late', 'dinner'],
  concert: ['late', 'dinner'],
  sports: ['afternoon', 'dinner', 'late'],
  food: ['dinner', 'lunch'],
  nightlife: ['late'],
  nature: ['morning', 'afternoon'],
  culture: ['morning', 'afternoon'],
  wellness: ['afternoon', 'morning'],
  city: ['afternoon', 'morning'],
};

const EMOJI: Record<Category, string> = {
  ski: '🎿', surf: '🏄', beach: '🏖️', festival: '🎉', concert: '🎶', sports: '🏟️',
  food: '🍽️', nightlife: '🍸', nature: '🌿', culture: '🏛️', wellness: '🧖', city: '🏙️',
};

export function activityCard(a: Activity): DesignerCard {
  const color = CATEGORY_META[a.category].color;
  const link = a.links?.officialSite ?? a.links?.tickets ?? a.ticketUrl ?? a.sources[0];
  return {
    id: `spot-${a.id}`.slice(0, 90),
    destination: 'custom',
    slots: SLOTS[a.category],
    title: a.name,
    blurb: a.summary,
    media: 'poster',
    palette: ['#141414', color],
    emoji: EMOJI[a.category],
    tags: ['spot', a.category],
    ...(link ? { link: { href: link, label: `More about ${a.name}` } } : {}),
  };
}

export const inTrip = (trip: Itinerary | null | undefined, a: Activity) => Boolean(trip?.cards?.some((card) => card.id === activityCard(a).id));

/** A new itinerary with the spot's card in it (and at the front of a fitting block); the same trip if it's already there. */
export function pinActivity(trip: Itinerary, a: Activity): Itinerary {
  const card = activityCard(a);
  if (inTrip(trip, a)) return trip;
  const days = trip.days.map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, cardIds: [...slot.cardIds] })) }));
  const dated = a.eventDates ? days.filter((day) => day.date >= a.eventDates!.start && day.date <= a.eventDates!.end) : [];
  const order = dated.length ? dated : days;
  for (const kind of card.slots) {
    const slot = order.flatMap((day) => day.slots).find((candidate) => candidate.kind === kind);
    if (!slot) continue;
    slot.cardIds = [card.id, ...slot.cardIds.filter((id) => id !== card.id)];
    break;
  }
  return { ...trip, cards: [...(trip.cards ?? []), card], days };
}

/** Takes it back out of the trip. */
export function unpinActivity(trip: Itinerary, a: Activity): Itinerary {
  const id = activityCard(a).id;
  return {
    ...trip,
    cards: (trip.cards ?? []).filter((card) => card.id !== id),
    days: trip.days.map((day) => ({ ...day, slots: day.slots.map((slot) => ({ ...slot, cardIds: slot.cardIds.filter((cardId) => cardId !== id) })) })),
  };
}

