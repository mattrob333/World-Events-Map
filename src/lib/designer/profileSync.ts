import { normalizeProfile, type ParseEngine } from './profile';
import type { SavedProfile } from './store';

/** A row of `traveler_profiles` (migration 009), as the member's client reads and writes it. */
export type RemoteProfile = {
  local_id: string;
  label: string | null;
  engine: string;
  data: unknown;
  deleted: boolean;
  updated_at: string;
};

const ENGINES: readonly ParseEngine[] = ['claude', 'on-device'];
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const time = (iso: string | undefined) => {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : 0;
};

export const syncableId = (id: string) => SAFE_ID.test(id);

export function toRemote(entry: SavedProfile): Omit<RemoteProfile, 'deleted'> & { deleted: false } {
  return { local_id: entry.id, label: entry.label ?? null, engine: entry.engine, data: entry.profile, deleted: false, updated_at: entry.updatedAt };
}

export function tombstone(localId: string, at = new Date()): RemoteProfile {
  return { local_id: localId, label: null, engine: 'on-device', data: {}, deleted: true, updated_at: at.toISOString() };
}

function fromRemote(row: RemoteProfile): SavedProfile {
  const engine = ENGINES.includes(row.engine as ParseEngine) ? (row.engine as ParseEngine) : 'on-device';
  return { id: row.local_id, profile: normalizeProfile(row.data), engine, updatedAt: row.updated_at, ...(row.label ? { label: row.label.slice(0, 24) } : {}) };
}

/**
 * Merges this device's profiles with the account's. The newer copy of each
 * profile wins; a deletion newer than the device's copy removes it; anything
 * newer here (or only here) is returned to push up.
 */
export function mergeProfiles(local: readonly SavedProfile[], remote: readonly RemoteProfile[]): { profiles: SavedProfile[]; push: SavedProfile[] } {
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const push: SavedProfile[] = [];
  for (const row of remote) {
    if (!syncableId(row.local_id)) continue;
    seen.add(row.local_id);
    const mine = byId.get(row.local_id);
    const remoteNewer = time(row.updated_at) > time(mine?.updatedAt);
    if (row.deleted) {
      if (mine && !remoteNewer) push.push(mine);
      else byId.delete(row.local_id);
    } else if (!mine || remoteNewer) {
      byId.set(row.local_id, fromRemote(row));
    } else if (time(mine.updatedAt) > time(row.updated_at)) {
      push.push(mine);
    }
  }
  for (const entry of local) if (!seen.has(entry.id) && syncableId(entry.id)) push.push(entry);
  const profiles = [...byId.values()].sort((a, b) => time(b.updatedAt) - time(a.updatedAt)).slice(0, 12);
  return { profiles, push: push.filter((entry) => profiles.includes(entry)) };
}

/** Only the account this device's profiles belong to ever syncs them. */
export function syncAllowed(accountSync: boolean, owner: string | null, userId: string | null): boolean {
  return accountSync && Boolean(userId) && owner === userId;
}

/**
 * After a merge, what the account is known to hold: the profiles now on this
 * device that didn't need pushing. A profile the merge had no room for is left
 * out, so it stays in the account instead of being read as deleted.
 */
export function knownAfterMerge(profiles: readonly SavedProfile[], push: readonly SavedProfile[]): Map<string, string> {
  return new Map(profiles.filter((entry) => !push.includes(entry)).map((entry) => [entry.id, entry.updatedAt]));
}

/** What to send: profiles changed since the account last had them, and ids removed here. */
export function pendingPush(profiles: readonly SavedProfile[], known: ReadonlyMap<string, string>): { changed: SavedProfile[]; removed: string[] } {
  const here = profiles.filter((entry) => syncableId(entry.id));
  return {
    changed: here.filter((entry) => known.get(entry.id) !== entry.updatedAt),
    removed: [...known.keys()].filter((id) => !here.some((entry) => entry.id === id)),
  };
}
