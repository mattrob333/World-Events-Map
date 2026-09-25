import type { Participant } from './itinerary';

/**
 * Who can vote on this device. Kids come on the trip but don't vote (unless
 * nobody else is listed). On a guest copy the organizer is never a choice:
 * their votes live on their own device.
 */
export function votersOf(participants: readonly Participant[], guest: boolean, meId?: string): Participant[] {
  const grownUps = participants.some((person) => person.kind !== 'kid') ? participants.filter((person) => person.kind !== 'kid') : [...participants];
  return guest ? grownUps.filter((person) => person.id !== participants[0]?.id || person.id === meId) : grownUps;
}
