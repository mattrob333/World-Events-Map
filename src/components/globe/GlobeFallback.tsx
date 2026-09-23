'use client';

/**
 * What the user sees when there is no globe: while the scene is loading, if the
 * WebGL context is lost, or if this machine cannot give us a context at all.
 *
 * All three are the same visual object — the page's own radial bloom with a
 * line of small-caps type over it — because the alternative is a white screen,
 * and a white screen in a product this dark reads as a crash even when it isn't.
 */

import { memo } from 'react';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';

export type GlobeFallbackKind = 'loading' | 'context-lost' | 'unsupported';

const COPY: Record<GlobeFallbackKind, { title: string; detail: string }> = {
  loading: {
    title: 'Charting',
    detail: 'Assembling the world',
  },
  'context-lost': {
    title: 'Signal lost',
    detail: 'The graphics context was interrupted — restoring',
  },
  unsupported: {
    title: 'Unavailable',
    detail: 'This display cannot render the globe. Everything else still works.',
  },
};

export interface GlobeFallbackProps {
  kind?: GlobeFallbackKind;
  /** Rendered above the canvas rather than in place of it. */
  overlay?: boolean;
}

function GlobeFallbackImpl({ kind = 'loading', overlay = false }: GlobeFallbackProps) {
  const copy = COPY[kind];
  const journey = useGlobeStore((state) => state.journey);

  return (
    <div
      role={kind === 'loading' ? 'status' : 'alert'}
      aria-live="polite"
      className={[
        'grid place-items-center bg-void/80',
        overlay ? 'absolute inset-0 z-10 backdrop-blur-sm' : 'h-full w-full',
      ].join(' ')}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          aria-hidden
          className="h-px w-16 brass-rule"
          style={{ opacity: kind === 'loading' ? 0.9 : 0.5 }}
        />
        <p className="label text-brass">{copy.title}</p>
        <p className="max-w-xs text-xs leading-relaxed text-ink-faint">
          {copy.detail}
        </p>
        {kind !== 'loading' && journey && (
          <div className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-ink-faint" aria-label="Selected travel route">
            <span>{journey.origin ? 'Starting point' : 'Current map view'}</span>
            <span aria-hidden className="h-px w-14 border-t border-dashed border-brass" />
            <span className="text-brass">Destination</span>
          </div>
        )}
      </div>
    </div>
  );
}

export const GlobeFallback = memo(GlobeFallbackImpl);
export default GlobeFallback;
