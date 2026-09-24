import { resolveDestination, type Itinerary } from './itinerary';
import { tripMoment } from './tripNow';

export type ResumeTarget = { href: string; title: string; detail: string };

/**
 * Where "pick up where you left off" goes: the trip in progress, unless it
 * is over. Pure, so the shell and tests agree on the rule.
 */
export function resumeTarget(trip: Pick<Itinerary, 'destination' | 'place' | 'days'> | null, now: Date): ResumeTarget | null {
  if (!trip?.days?.length) return null;
  const name = trip.place?.name ?? resolveDestination(trip)?.name;
  if (!name) return null;
  const moment = tripMoment(trip, now);
  if (moment.phase === 'after') return null;
  if (moment.phase === 'before') {
    const when = moment.daysUntil === 0 ? 'starts today' : moment.daysUntil === 1 ? 'starts tomorrow' : `is ${moment.daysUntil} days out`;
    return { href: '/trips/designer', title: `Your ${name} trip`, detail: `It ${when}. Keep designing.` };
  }
  return { href: '/trips/designer', title: `You’re on your ${name} trip`, detail: 'Here’s what’s on right now.' };
}
