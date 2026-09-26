'use client';

import { useEffect, useRef } from 'react';
import { knownAfterMerge, mergeProfiles, pendingPush, syncAllowed, toRemote, tombstone, type RemoteProfile } from '@/lib/designer/profileSync';
import { useDesignerStore } from '@/lib/designer/store';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

const PUSH_DELAY_MS = 1500;
const COLUMNS = 'local_id,label,engine,data,deleted,updated_at';

/**
 * Account saving for traveler profiles, once the member turns it on in
 * Settings (it's off until then). It only ever runs for the account this
 * device's profiles belong to: someone else signing in on the same browser
 * never receives them. On sign-in the account copy and this device merge
 * (newer wins); after that, edits and deletions here go up a moment later,
 * one profile per request so one bad row can't block the rest. Renders nothing.
 */
export function ProfileSync() {
  const { client, user } = usePlatformAuth();
  const userId = user?.id ?? null;
  const accountSync = useDesignerStore((state) => state.accountSync);
  const syncOwner = useDesignerStore((state) => state.syncOwner);
  // What the account is known to hold: id → updatedAt of the copy last pushed or pulled.
  const synced = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!client || !syncAllowed(accountSync, syncOwner, userId)) return;
    let active = true;
    let timer: number | undefined;
    synced.current = null;
    const { setSyncStatus } = useDesignerStore.getState();

    const upsertOne = async (row: RemoteProfile) => {
      const { error } = await client.from('traveler_profiles').upsert({ ...row, user_id: userId }, { onConflict: 'user_id,local_id' });
      return !error;
    };

    const pushChanges = async () => {
      const known = synced.current;
      const state = useDesignerStore.getState();
      if (!active || !known || !state.accountSync) return;
      const { changed, removed } = pendingPush(state.profiles, known);
      if (!changed.length && !removed.length) return;
      setSyncStatus('syncing');
      let failed = false;
      // Checked before every write: once saving is off (or the page moves on), nothing more goes up.
      for (const entry of changed) {
        if (!active) return;
        if (await upsertOne(toRemote(entry))) known.set(entry.id, entry.updatedAt);
        else failed = true;
      }
      for (const id of removed) {
        if (!active) return;
        if (await upsertOne(tombstone(id))) known.delete(id);
        else failed = true;
      }
      if (active) setSyncStatus(failed ? 'error' : 'saved');
    };

    let starting = false;
    const start = async () => {
      if (starting) return;
      starting = true;
      try {
        await pull();
      } finally {
        starting = false;
      }
    };

    const pull = async () => {
      // This device's saved profiles must be loaded before anything merges.
      if (!useDesignerStore.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const off = useDesignerStore.persist.onFinishHydration(() => { off(); resolve(); });
        });
      }
      if (!active || synced.current) return;
      setSyncStatus('syncing');
      const { data, error } = await client.from('traveler_profiles').select(COLUMNS).eq('user_id', userId).limit(80);
      if (!active) return;
      if (error) {
        setSyncStatus('error');
        return;
      }
      const rows = (data ?? []) as RemoteProfile[];
      const store = useDesignerStore.getState();
      const { profiles, push } = mergeProfiles(store.profiles, rows);
      // Only what this device now holds is "known": a profile the merge had no
      // room for stays in the account instead of being read as deleted.
      synced.current = knownAfterMerge(profiles, push);
      store.applySyncedProfiles(profiles);
      await pushChanges();
      if (active && useDesignerStore.getState().syncStatus === 'syncing') setSyncStatus('saved');
    };

    // Back online or back on the page: finish a first pull that failed, or retry saves that did.
    const retry = () => {
      if (document.visibilityState !== 'visible') return;
      if (!synced.current) void start();
      else if (useDesignerStore.getState().syncStatus === 'error') void pushChanges();
    };

    void start();
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    const unsubscribe = useDesignerStore.subscribe((state, previous) => {
      if (state.profiles === previous.profiles || !state.accountSync) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void pushChanges(), PUSH_DELAY_MS);
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
      unsubscribe();
    };
  }, [client, userId, accountSync, syncOwner]);

  return null;
}
