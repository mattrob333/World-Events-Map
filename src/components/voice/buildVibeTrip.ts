import { travelersFromBoard } from '@/components/designer/TripDesigner';
import { DESTINATIONS, type DestinationKind } from '@/lib/designer/catalog';
import { composeLocally, participantStyle, type Itinerary, type Participant } from '@/lib/designer/itinerary';
import { tasteFrom } from '@/lib/designer/scene';
import type { SavedProfile } from '@/lib/designer/store';
import { pinPicks } from '@/lib/designer/vibePicks';
import { samePlace, type CanvasSpot } from '@/lib/voice/canvas';

function isoDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * The Vibe canvas straight to a time-blocked schedule, no setup form: the
 * place they settled on, the dates from the conversation, the crew from the
 * profile they planned as, and every pick leading a matching time block.
 */
export function buildVibeTrip(input: {
  place: string;
  region?: string;
  kind: DestinationKind;
  start?: string;
  nights?: number;
  board?: SavedProfile;
  spots: readonly CanvasSpot[];
}): Itinerary {
  const today = isoDaysFromNow(0);
  const startDate = input.start && input.start >= today ? input.start : isoDaysFromNow(30);
  const nights = Math.max(1, Math.min(14, input.nights ?? 5));
  const people = input.board ? travelersFromBoard(input.board) : [{ key: 'you', name: 'You', kind: 'adult' as const, tags: [] as string[] }];
  const participants: Participant[] = people.slice(0, 10).map((person, i) => ({ id: `p${i}`, name: person.name, kind: person.kind, age: 'age' in person ? person.age : undefined, tags: person.tags, ...participantStyle(i) }));
  const profile = input.board?.profile;
  const taste = profile ? tasteFrom(profile) : undefined;
  // A curated destination (St. Moritz, Aspen…) keeps its editorial cards; anywhere else is built from searches.
  const curated = DESTINATIONS.find((destination) => destination.id !== 'custom' && samePlace(destination.name, input.place));
  const base = curated
    ? composeLocally({ destination: curated.id, startDate, nights, hometown: profile?.hometown, participants })
    : composeLocally({ destination: 'custom', place: { name: input.place.slice(0, 60), region: input.region?.slice(0, 60) || undefined, kind: input.kind }, startDate, nights, hometown: profile?.hometown, participants, foods: profile?.food.slice(0, 3), taste });
  return { ...pinPicks(base, input.spots), ...(taste ? { taste } : {}) };
}
