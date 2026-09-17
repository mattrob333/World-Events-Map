import 'server-only';

/** Live signal access and process-local state. Import only on the server. */
import type { BuzzSignals, WorldEvent } from '@/lib/types';
import { EVENTS, getEventsByIds } from './index';
import { applySignalPatches, collectSignalPatches, getSourceHealth } from './sources';
import { persistSnapshots, readSnapshots, signalDatabase } from './durable';

export { getSourceHealth, getSourceHealth as sourceHealth } from './sources';
export { SOURCES, LIVE_SOURCES, anyLiveConfigured } from './sources';

/** Per-call subset limit, enforced before deduplication or unknown-id filtering. */
export const MAX_IDS = 60;
export const SIGNAL_TTL_MS = 10 * 60 * 1000;

interface SignalCacheEntry {
  /** Missing patches are cached too, so an empty vendor result respects TTL. */
  patch?: Partial<BuzzSignals>;
  fetchedAt: number;
}

// Each event owns its TTL: refreshing one subset cannot warm another subset.
const signalCache = new Map<string, SignalCacheEntry>();
let lastFetchedAt: number | null = null;
let storageStatus: 'unconfigured' | 'connected' | 'error' = 'unconfigured';

async function hydrateSnapshots() {
  try {
    const rows = await readSnapshots(SIGNAL_TTL_MS);
    storageStatus = signalDatabase() ? 'connected' : 'unconfigured';
    for (const row of rows) {
      const fetchedAt = Date.parse(row.fetched_at);
      if (Number.isFinite(fetchedAt) && fetchedAt > (signalCache.get(row.event_id)?.fetchedAt ?? 0)) {
        signalCache.set(row.event_id, { patch: row.patch, fetchedAt });
        lastFetchedAt = Math.max(lastFetchedAt ?? 0, fetchedAt);
      }
    }
  } catch { storageStatus = 'error'; }
}

/**
 * Overlapping ids share the same pending collection promise, including forced
 * refreshes and sweeps. Only ids without pending work start another collection.
 * This guard and the per-call cap apply within ONE server process. A GLOBAL
 * spend ceiling across server instances requires durable state, deferred to
 * M-039. These guards do not limit sequential authorized calls or total spend.
 */
const inFlight = new Map<string, Promise<void>>();

/** Read fresh patches only; a cold/expired entry leaves the curated baseline. */
export function getCachedSignalPatches(ids: string[]): Map<string, Partial<BuzzSignals>> {
  const patches = new Map<string, Partial<BuzzSignals>>();
  const now = Date.now();
  for (const id of ids) {
    const entry = signalCache.get(id);
    if (entry?.patch && now - entry.fetchedAt < SIGNAL_TTL_MS) {
      patches.set(id, { ...entry.patch });
    }
  }
  return patches;
}

async function refreshEvents(
  events: WorldEvent[],
  options: { force?: boolean },
): Promise<Map<string, Partial<BuzzSignals>>> {
  const pending = new Set<Promise<void>>();
  const missing: WorldEvent[] = [];
  const now = Date.now();

  for (const event of events) {
    const work = inFlight.get(event.id);
    if (work) {
      pending.add(work);
      continue;
    }
    const entry = signalCache.get(event.id);
    if (!options.force && entry && now - entry.fetchedAt < SIGNAL_TTL_MS) continue;
    missing.push(event);
  }

  if (missing.length) {
    // Start in a microtask so every id is registered before adapters execute.
    const work = Promise.resolve().then(async () => {
      try {
        const patches = await collectSignalPatches(missing);
        const fetchedAt = Date.now();
        for (const event of missing) {
          signalCache.set(event.id, { patch: patches.get(event.id), fetchedAt });
        }
        lastFetchedAt = fetchedAt;
        try {
          await persistSnapshots(missing.map((event) => ({ event_id: event.id, patch: patches.get(event.id) ?? {}, fetched_at: new Date(fetchedAt).toISOString() })));
          storageStatus = signalDatabase() ? 'connected' : 'unconfigured';
        } catch { storageStatus = 'error'; }
      } finally {
        for (const event of missing) inFlight.delete(event.id);
      }
    });
    for (const event of missing) inFlight.set(event.id, work);
    pending.add(work);
  }

  // Adapters isolate their own failures. An unexpected collection failure also
  // leaves existing entries intact; public reads still enforce each entry's TTL.
  await Promise.allSettled(pending);
  return getCachedSignalPatches(events.map((event) => event.id));
}

/** Refresh at most MAX_IDS supplied ids; adapters see only known, due events. */
export async function getSignalPatches(
  ids: string[],
  options: { force?: boolean } = {},
): Promise<Map<string, Partial<BuzzSignals>>> {
  if (ids.length > MAX_IDS) throw new RangeError(`At most ${MAX_IDS} ids are allowed`);
  return refreshEvents(getEventsByIds([...new Set(ids)]), options);
}

/** Authorized callers only. Force bypasses TTL, never the in-flight guard. */
export async function refreshSignals(
  ids: string[],
  options: { force?: boolean } = {},
): Promise<Record<string, Partial<BuzzSignals>>> {
  return Object.fromEntries(await getSignalPatches(ids, options));
}

/** Deliberate full-calendar refresh; only the authorized admin path calls this. */
export async function sweepAllSignals(): Promise<Record<string, Partial<BuzzSignals>>> {
  return Object.fromEntries(await refreshEvents(EVENTS, { force: true }));
}

/** Curated calendar enriched from fresh cached patches; never fetches vendors. */
export async function getEnrichedEvents(): Promise<WorldEvent[]> {
  await hydrateSnapshots();
  return applySignalPatches(EVENTS, getCachedSignalPatches(EVENTS.map((event) => event.id)));
}

/** Age of the latest completed refresh (possibly a subset), or null before any. */
export function signalCacheAgeMs(): number | null {
  return lastFetchedAt === null ? null : Date.now() - lastFetchedAt;
}

/** Diagnostics payload shared by `/api/events` and `/api/sources`. */
export function dataMeta() {
  return {
    enrichedAt: [...signalCache.values()].filter((entry) => entry.patch && Object.keys(entry.patch).length && Date.now() - entry.fetchedAt < SIGNAL_TTL_MS).reduce<string | null>((latest, entry) => {
      const time = new Date(entry.fetchedAt).toISOString();
      return !latest || time > latest ? time : latest;
    }, null),
    storageStatus,
    eventCount: EVENTS.length,
    signalCacheAgeMs: signalCacheAgeMs(),
    signalTtlMs: SIGNAL_TTL_MS,
    sources: getSourceHealth(),
  };
}
