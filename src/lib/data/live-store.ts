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

/** Server snapshots refresh at most every ten minutes; polling faster only re-downloads the same calendar. */
export const LIVE_POLL_MS = 5 * 60_000;

/**
 * Identifies a calendar response: its enrichment time plus the event ids. When
 * it matches what's on screen, nothing is applied, so the page doesn't re-rank
 * and re-render the whole world on every poll.
 */
export function calendarFingerprint(events: readonly Pick<WorldEvent, 'id'>[], enrichedAt: string | null): string {
  let hash = 0;
  for (const event of events) {
    for (let i = 0; i < event.id.length; i++) hash = (hash * 31 + event.id.charCodeAt(i)) | 0;
  }
  return `${enrichedAt ?? 'curated'}|${events.length}|${hash}`;
}

/** Reads our cache only. Browser traffic never starts billable vendor requests. */
export function useLiveCalendarSync() {
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    let shown = calendarFingerprint(useLiveCalendar.getState().events, useLiveCalendar.getState().enrichedAt);
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
        const incoming = calendarFingerprint(data.events, data.meta?.enrichedAt ?? null);
        if (incoming === shown && useLiveCalendar.getState().status !== 'offline') return;
        shown = incoming;
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
          shown = calendarFingerprint(EVENTS, null);
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
    // The bundled calendar paints first; the live read waits until the page is idle.
    const idle = typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(() => void load(), { timeout: 4000 })
      : window.setTimeout(() => void load(), 1500);
    const timer = window.setInterval(load, LIVE_POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, []);
}
