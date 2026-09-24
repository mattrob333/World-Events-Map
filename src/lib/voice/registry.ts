'use client';

import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import type { VoiceIntent, VoiceToolName } from './tools';

/** A tool handler returns a short sentence the Sun can say back ("Set: Lisbon, 5 nights"). */
export type VoiceHandler = (args: Record<string, unknown>) => string | Promise<string>;
export type VoiceHandlers = Partial<Record<VoiceToolName, VoiceHandler>>;

type PageVoice = {
  intent: VoiceIntent;
  /** One plain line describing what's on screen, sent as context. */
  context: () => string;
  handlers: VoiceHandlers;
  /** What typed text does when voice isn't available at all (no key, no network). */
  fallback?: (text: string) => string | Promise<string>;
};

type VoiceState = {
  page: PageVoice | null;
  open: boolean;
  setPage: (page: PageVoice | null) => void;
  setOpen: (open: boolean) => void;
};

export const useVoiceStore = create<VoiceState>((set) => ({
  page: null,
  open: false,
  setPage: (page) => set({ page }),
  setOpen: (open) => set({ open }),
}));

/**
 * Registers what the Sun can do on this page. Handlers and context are read
 * through refs, so they always see the page's latest state.
 */
export function useVoicePage(intent: VoiceIntent, handlers: VoiceHandlers, context: () => string, fallback?: PageVoice['fallback']) {
  const latest = useRef({ handlers, context, fallback });
  useEffect(() => {
    latest.current = { handlers, context, fallback };
  });
  useEffect(() => {
    const names = Object.keys(latest.current.handlers) as VoiceToolName[];
    const proxied: VoiceHandlers = {};
    for (const name of names) proxied[name] = (args) => latest.current.handlers[name]!(args);
    useVoiceStore.getState().setPage({
      intent,
      handlers: proxied,
      context: () => latest.current.context(),
      fallback: latest.current.fallback ? (text) => latest.current.fallback!(text) : undefined,
    });
    return () => {
      if (useVoiceStore.getState().page?.handlers === proxied) useVoiceStore.getState().setPage(null);
    };
    // Tool names are fixed per page; handlers update through the ref.
  }, [intent]);
}
