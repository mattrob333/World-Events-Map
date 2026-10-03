'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { create } from 'zustand';

/** How long a field the sun changed stays lit. */
export const GLOW_MS = 2400;

type GlowState = { keys: Record<string, number>; glow: (keys: string[]) => void };

/**
 * What the sun just changed on a page, so the page can light it up
 * (data-voice-glow). Kept outside the page so a change made just before
 * opening a page still glows once it's there.
 */
export const useGlowStore = create<GlowState>((set) => ({
  keys: {},
  glow: (keys) => {
    if (!keys.length) return;
    const at = Date.now();
    set((state) => ({ keys: { ...state.keys, ...Object.fromEntries(keys.map((key) => [key, at])) } }));
    window.setTimeout(() => {
      set((state) => ({ keys: Object.fromEntries(Object.entries(state.keys).filter(([, when]) => when !== at)) }));
    }, GLOW_MS);
  },
}));

export const glow = (...keys: string[]) => useGlowStore.getState().glow(keys);

/** Spread onto the element: `{...useGlow('ski:window')}`. */
export function useGlow(key: string): { 'data-voice-glow'?: string } {
  const at = useGlowStore((state) => state.keys[key]);
  // Lit until GLOW_MS after the latest glow of this key.
  return at ? { 'data-voice-glow': String(at) } : {};
}

/** useGlow, plus the element scrolls into view when it lights up (a card off to the side of a rail). */
export function useGlowScroll<T extends HTMLElement>(key: string): [RefObject<T | null>, { 'data-voice-glow'?: string }] {
  const ref = useRef<T | null>(null);
  const props = useGlow(key);
  const at = props['data-voice-glow'];
  useEffect(() => {
    if (at) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [at]);
  return [ref, props];
}
