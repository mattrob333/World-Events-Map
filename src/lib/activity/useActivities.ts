'use client';

import { useEffect, useState } from 'react';
import type { Activity } from './activities';

let loaded: Activity[] | null = null;
let loading: Promise<Activity[]> | null = null;

/** Loads the curated list once, in its own chunk. */
export function loadActivities(): Promise<Activity[]> {
  loading ??= import('./data').then((m) => (loaded = m.ACTIVITIES));
  return loading;
}

/**
 * The curated spots and events, or null until they've loaded. Pass false to
 * skip loading (nothing on the page needs them yet).
 */
export function useActivities(enabled = true): Activity[] | null {
  const [list, setList] = useState<Activity[] | null>(loaded);
  useEffect(() => {
    if (!enabled || list) return;
    let live = true;
    void loadActivities().then((all) => {
      if (live) setList(all);
    });
    return () => {
      live = false;
    };
  }, [enabled, list]);
  return list;
}
