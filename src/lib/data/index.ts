/**
 * dope.travel — client-safe curated read model.
 * Pure reads only: no adapters, environment access, or live refreshes.
 */

import type { WorldEvent } from '@/lib/types';
import { EVENTS, EVENT_INDEX } from '@/lib/data/events';

export type { BuzzSignals, WorldEvent } from '@/lib/types';

/** The curated calendar, exactly as authored. Never mutate the result. */
export function getEvents(): WorldEvent[] {
  return EVENTS;
}

export function getEventById(id: string): WorldEvent | undefined {
  return EVENT_INDEX.get(id);
}

export function getEventsByIds(ids: string[]): WorldEvent[] {
  const out: WorldEvent[] = [];
  for (const id of ids) {
    const e = EVENT_INDEX.get(id);
    if (e) out.push(e);
  }
  return out;
}

export { EVENTS, EVENT_INDEX };
