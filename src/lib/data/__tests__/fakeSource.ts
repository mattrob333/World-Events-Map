import { vi } from 'vitest';
import type { BuzzSignals, EventSource, WorldEvent } from '@/lib/types';

/** Exercise the real registry/facade with a recording adapter and no network. */
export async function registerFakeSource() {
  const { SOURCES, LIVE_SOURCES } = await import('../sources');
  for (const source of LIVE_SOURCES) vi.spyOn(source, 'isConfigured').mockReturnValue(false);

  const receivedIds: string[][] = [];
  const fetchSignals = vi.fn(async (events: WorldEvent[]) => {
    receivedIds.push(events.map((event) => event.id));
    return new Map<string, Partial<BuzzSignals>>(
      events.map((event) => [event.id, { searchInterest: 73 }]),
    );
  });
  const source: EventSource = {
    id: 'fake',
    label: 'Recording test source',
    isConfigured: () => true,
    fetchSignals,
    health: () => ({
      id: 'fake',
      label: 'Recording test source',
      status: receivedIds.length ? 'live' : 'stale',
      detail: receivedIds.length ? 'Fetched test patches' : 'Configured, awaiting first sync',
    }),
  };
  SOURCES.push(source);
  LIVE_SOURCES.push(source);
  return { source, fetchSignals, receivedIds };
}
