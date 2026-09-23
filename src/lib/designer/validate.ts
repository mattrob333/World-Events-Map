import { DESTINATION_INDEX, type DestinationId } from './catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, isIsoDate, participantStyle, type ComposeInput, type Participant } from './itinerary';

const TAG_PATTERN = /^[a-z][a-z-]{1,23}$/;

export class InputError extends Error {}

function text(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

export function validateComposeBody(body: unknown): { input: ComposeInput; profileNotes: string[] } {
  if (!body || typeof body !== 'object') throw new InputError('Request body must be an object.');
  const source = body as Record<string, unknown>;
  const destination = source.destination;
  if (typeof destination !== 'string' || !DESTINATION_INDEX.has(destination as DestinationId)) {
    throw new InputError('Choose a destination from the list.');
  }
  const startDate = source.startDate;
  if (typeof startDate !== 'string' || !isIsoDate(startDate)) throw new InputError('Choose a valid start date.');
  const nights = Number(source.nights);
  if (!Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) throw new InputError(`Trips can be 1 to ${MAX_NIGHTS} nights.`);
  const rawPeople = Array.isArray(source.participants) ? source.participants.slice(0, MAX_PARTICIPANTS) : [];
  const participants: Participant[] = rawPeople.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const person = raw as Record<string, unknown>;
    const name = text(person.name, 30);
    if (!name) return [];
    const age = typeof person.age === 'number' && person.age >= 0 && person.age <= 110 ? Math.round(person.age) : undefined;
    const tags = (Array.isArray(person.tags) ? person.tags : [])
      .filter((tag): tag is string => typeof tag === 'string' && TAG_PATTERN.test(tag))
      .slice(0, 16);
    return [{
      id: text(person.id, 40) ?? `p${index}`,
      name,
      kind: person.kind === 'kid' ? 'kid' : 'adult',
      age,
      tags,
      ...participantStyle(index),
    } satisfies Participant];
  });
  if (!participants.length) throw new InputError('Add at least one traveler.');
  const profileNotes = (Array.isArray(source.profileNotes) ? source.profileNotes : [])
    .map((note) => text(note, 240))
    .filter((note): note is string => Boolean(note))
    .slice(0, MAX_PARTICIPANTS);
  return {
    input: { destination: destination as DestinationId, startDate, nights, hometown: text(source.hometown, 60), participants },
    profileNotes,
  };
}
