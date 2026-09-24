/**
 * What dope.travel keeps in this browser, and how to get rid of it.
 *
 * - `meridian.designer.v1`: mood boards, the trip draft (names, kids' ages,
 *   home city), votes, the previous trip an invite replaced, and the raw
 *   spoken ramble. Owned by the designer store (`clearAll`).
 * - `dope.research.v1:<key>`: cached destination research, ~55 KB each.
 *   Pruned to the newest {@link RESEARCH_KEEP} entries on every write.
 *
 * Everything here tolerates blocked or full storage: the app still works for
 * the visit, it just can't remember.
 */

export const DESIGNER_STORAGE_KEY = 'meridian.designer.v1';
/** Covers every research cache generation (v1 whole-trip, v2 place and fares). */
export const RESEARCH_PREFIX = 'dope.research.';
export const RESEARCH_KEEP = 10;

type KeyStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function browserStorage(): KeyStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Every research cache key on this device. */
export function researchKeys(storage: KeyStore | null = browserStorage()): string[] {
  if (!storage) return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(RESEARCH_PREFIX)) keys.push(key);
    }
  } catch {
    return keys;
  }
  return keys;
}

function writtenAt(storage: KeyStore, key: string): number {
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null') as { generatedAt?: unknown } | null;
    const at = typeof value?.generatedAt === 'string' ? Date.parse(value.generatedAt) : Number.NaN;
    return Number.isNaN(at) ? 0 : at;
  } catch {
    return 0;
  }
}

/**
 * Keeps the newest `keep` research entries (by their `generatedAt`) and
 * removes the rest. `protect` is never removed (the entry just written).
 * Returns how many were removed.
 */
export function pruneResearchCache(keep: number = RESEARCH_KEEP, protect?: string, storage: KeyStore | null = browserStorage()): number {
  if (!storage) return 0;
  const ranked = researchKeys(storage)
    .map((key) => ({ key, at: key === protect ? Number.POSITIVE_INFINITY : writtenAt(storage, key) }))
    .sort((a, b) => b.at - a.at);
  let removed = 0;
  for (const { key } of ranked.slice(Math.max(0, keep))) {
    try {
      storage.removeItem(key);
      removed += 1;
    } catch {
      // Blocked storage: nothing else to do.
    }
  }
  return removed;
}

/**
 * Writes one research cache entry and prunes the cache to the newest `keep`.
 * If storage is full, prunes harder and tries once more. `key` must start
 * with {@link RESEARCH_PREFIX}. Returns whether the entry was stored.
 */
export function writeResearchCache(key: string, value: unknown, keep: number = RESEARCH_KEEP, storage: KeyStore | null = browserStorage()): boolean {
  if (!storage || !key.startsWith(RESEARCH_PREFIX)) return false;
  const text = JSON.stringify(value);
  try {
    storage.setItem(key, text);
  } catch {
    pruneResearchCache(Math.max(0, Math.floor(keep / 2)), undefined, storage);
    try {
      storage.setItem(key, text);
    } catch {
      return false;
    }
  }
  pruneResearchCache(keep, key, storage);
  return true;
}

/** Removes every research cache entry. Returns how many were removed. */
export function clearResearchCache(storage: KeyStore | null = browserStorage()): number {
  return pruneResearchCache(0, undefined, storage);
}

/**
 * Removes everything dope.travel's trip designer keeps in this browser: the
 * research cache and the designer's persisted state. Call the store's
 * `clearAll()` too (or first), so the open page forgets it as well.
 */
export function clearDeviceData(storage: KeyStore | null = browserStorage()): void {
  clearResearchCache(storage);
  try {
    storage?.removeItem(DESIGNER_STORAGE_KEY);
  } catch {
    // Blocked storage: nothing was persisted.
  }
}
