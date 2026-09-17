'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { EVENTS } from './events';
import type { SourceHealth, WorldEvent } from '@/lib/types';

interface LiveCalendar {
  events: WorldEvent[];
  revision: number;
  checkedAt: string | null;
  enrichedAt: string | null;
  sources: SourceHealth[];
  status: 'curated' | 'enriched' | 'offline';
  apply: (
    events: WorldEvent[],
    sources: SourceHealth[],
    enrichedAt: string | null,
  ) => void;
}

export const useLiveCalendar = create<LiveCalendar>((set) => ({
  events: EVENTS,
  revision: 0,
  checkedAt: null,
  enrichedAt: null,
  sources: [],
  status: 'curated',
  apply: (events, sources, enrichedAt) =>
    set((state) => ({
      events,
      sources,
      enrichedAt,
      revision: state.revision + 1,
      checkedAt: new Date().toISOString(),
      status: enrichedAt ? 'enriched' : 'curated',
    })),
}));

/** Reads our cache only. Browser traffic never starts billable vendor requests. */
export function useLiveCalendarSync() {
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const load = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await fetch('/api/events', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Calendar unavailable');
        const data = await response.json();
        if (!Array.isArray(data.events) || !data.events.length)
          throw new Error('Empty calendar');
        useLiveCalendar
          .getState()
          .apply(
            data.events,
            data.meta?.sources ?? [],
            data.meta?.enrichedAt ?? null,
          );
      } catch {
        if (!controller.signal.aborted) {
          // Drop old enrichment on a failed read rather than continuing to rank stale signals.
          useLiveCalendar.setState((s) => ({
            events: EVENTS,
            revision: s.revision + 1,
            status: 'offline',
            enrichedAt: null,
          }));
        }
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
}
