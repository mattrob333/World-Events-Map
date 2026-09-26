'use client';

import { useEffect, useRef } from 'react';
import { knownAfterMerge, mergeProfiles, pendingPush, syncAllowed, toRemote, tombstone, type RemoteProfile } from '@/lib/designer/profileSync';
import { useDesignerStore } from '@/lib/designer/store';
import { knownItems, localItems, mergeItems, pendingItems, stateFromItems, stateTombstone, toRemoteState, type RemoteState } from '@/lib/travelers/stateSync';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

const PUSH_DELAY_MS = 1500;
const COLUMNS = 'local_id,label,engine,data,deleted,updated_at';
const STATE_COLUMNS = 'kind,local_id,data,deleted,updated_at';
/** Postgres "no such table" and PostgREST "not in the schema cache". */
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);

/**
 * Account saving for traveler profiles, once the member turns it on in
 * Settings (it's off until then). It only ever runs for the account this
 * device's profiles belong to: someone else signing in on the same browser
 * never receives them. On sign-in the account copy and this device merge
 * (newer wins); after that, edits and deletions here go up a moment later,
 * one profile per request so one bad row can't block the rest. Groups, trips
 * (with votes) and "which profile is you" follow the same rules in
 * `traveler_state`, merged after the profiles they point at. Renders nothing.
 */
export function ProfileSync() {
  const { client, user } = usePlatformAuth();
  const userId = user?.id ?? null;
  const accountSync = useDesignerStore((state) => state.accountSync);
  const syncOwner = useDesignerStore((state) => state.syncOwner);
  // What the account is known to hold: id → updatedAt of the copy last pushed or pulled.
  const synced = useRef<Map<string, string> | null>(null);
  // The same for groups, trips and "you": `kind:id` → updatedAt.
  const syncedState = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!client || !syncAllowed(accountSync, syncOwner, userId)) return;
    let active = true;
    let timer: number | undefined;
    let stateUnavailable = false;
    synced.current = null;
    syncedState.current = null;
    const { setSyncStatus } = useDesignerStore.getState();

    const upsertOne = async (row: RemoteProfile) => {
      const { error } = await client.from('traveler_profiles').upsert({ ...row, user_id: userId }, { onConflict: 'user_id,local_id' });
      return !error;
    };

    const upsertState = async (row: RemoteState) => {
      const { error } = await client.from('traveler_state').upsert({ ...row, user_id: userId }, { onConflict: 'user_id,kind,local_id' });
      return !error;
    };

    const pushChanges = async () => {
      const known = synced.current;
      const knownState = syncedState.current;
      const state = useDesignerStore.getState();
      if (!active || !known || !state.accountSync) return;
      const { changed, removed } = pendingPush(state.profiles, known);
      const items = knownState ? pendingItems(localItems(state), knownState) : { changed: [], removed: [] };
      if (!changed.length && !removed.length && !items.changed.length && !items.removed.length) return;
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
      for (const item of items.changed) {
        if (!active || !knownState) return;
        if (await upsertState(toRemoteState(item))) knownState.set(`${item.kind}:${item.id}`, item.updatedAt);
        else failed = true;
      }
      for (const item of items.removed) {
        if (!active || !knownState) return;
        if (await upsertState(stateTombstone(item.kind, item.id))) knownState.delete(`${item.kind}:${item.id}`);
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
      // Then groups, trips and "you", which point at the profiles just merged.
      const stateResult = await client.from('traveler_state').select(STATE_COLUMNS).eq('user_id', userId).limit(400);
      if (!active) return;
      if (!stateResult.error) {
        const merged = mergeItems(localItems(useDesignerStore.getState()), (stateResult.data ?? []) as RemoteState[]);
        useDesignerStore.getState().applySyncedState(stateFromItems(merged.items));
        // Known: what the account holds and this device now agrees with. Anything the apply changed goes up next.
        syncedState.current = knownItems(merged.items, merged.push);
      } else if (MISSING_TABLE.has(stateResult.error.code ?? '')) {
        // Migration 010 isn't applied on this project yet: profiles still save; groups and trips stay on the device.
        stateUnavailable = true;
      } else {
        setSyncStatus('error');
      }
      await pushChanges();
      if (active && useDesignerStore.getState().syncStatus === 'syncing') setSyncStatus('saved');
    };

    // Back online or back on the page: finish a first pull that failed, or retry saves that did.
    const retry = () => {
      if (document.visibilityState !== 'visible') return;
      if (!synced.current || (!syncedState.current && !stateUnavailable)) {
        synced.current = null;
        void start();
      }
      else if (useDesignerStore.getState().syncStatus === 'error') void pushChanges();
    };

    void start();
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    const unsubscribe = useDesignerStore.subscribe((state, previous) => {
      const moved = state.profiles !== previous.profiles || state.groups !== previous.groups || state.trip !== previous.trip || state.votes !== previous.votes
        || state.previousTrip !== previous.previousTrip || state.meId !== previous.meId || state.youUpdatedAt !== previous.youUpdatedAt || state.tripUpdatedAt !== previous.tripUpdatedAt;
      if (!moved || !state.accountSync) return;
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
