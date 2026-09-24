'use client';

import { IconButton, Rule, Tooltip, cn } from '@/components/ui';
import { useGlobeStore, type GlobeQuality } from '@/lib/stores/useGlobeStore';

const QUALITY: { value: GlobeQuality; label: string; note: string }[] = [
  { value: 'high', label: 'HI', note: 'Full effects. Best on a discrete GPU' },
  { value: 'balanced', label: 'MD', note: 'Fewer passes, same geometry' },
  { value: 'economy', label: 'LO', note: 'Minimum draw. For long sessions on battery' },
];

export interface GlobeControlsProps {
  className?: string;
}

/**
 * The four things worth changing about the globe, and nothing else.
 *
 * Rendering options are not a settings screen here — they sit next to the
 * object they affect, as three latches and a quality selector, and each one is
 * a single press.
 */
export function GlobeControls({ className }: GlobeControlsProps) {
  const autoRotate = useGlobeStore((s) => s.autoRotate);
  const setAutoRotate = useGlobeStore((s) => s.setAutoRotate);
  const showLandmass = useGlobeStore((s) => s.showLandmass);
  const toggleLandmass = useGlobeStore((s) => s.toggleLandmass);
  const showGraticule = useGlobeStore((s) => s.showGraticule);
  const toggleGraticule = useGlobeStore((s) => s.toggleGraticule);
  const quality = useGlobeStore((s) => s.quality);
  const setQuality = useGlobeStore((s) => s.setQuality);

  return (
    <div
      className={cn(
        'surface flex w-fit items-center gap-1 rounded-full px-2 py-1.5',
        className,
      )}
    >
      <Tooltip content={autoRotate ? 'Stop the rotation' : 'Let the globe turn'}>
        <IconButton
          label="Auto-rotate"
          variant="ghost"
          selected={autoRotate}
          aria-pressed={autoRotate}
          onClick={() => setAutoRotate(!autoRotate)}
        >
          <svg viewBox="0 0 14 14" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={1} aria-hidden>
            <circle cx="7" cy="7" r="5" />
            <ellipse cx="7" cy="7" rx="2.2" ry="5" />
            <path d="M2 7h10" />
          </svg>
        </IconButton>
      </Tooltip>

      <Tooltip content="Country fills">
        <IconButton
          label="Landmass"
          variant="ghost"
          selected={showLandmass}
          aria-pressed={showLandmass}
          onClick={toggleLandmass}
        >
          <svg viewBox="0 0 14 14" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={1} strokeLinejoin="round" aria-hidden>
            <path d="M1.6 8.2 4 4.6l3 1.2 2.2-2.6 3.2 1.4-1.4 3.6-3 .6-1.6 2.6-3-1Z" />
          </svg>
        </IconButton>
      </Tooltip>

      <Tooltip content="Latitude and longitude">
        <IconButton
          label="Graticule"
          variant="ghost"
          selected={showGraticule}
          aria-pressed={showGraticule}
          onClick={toggleGraticule}
        >
          <svg viewBox="0 0 14 14" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={1} aria-hidden>
            <circle cx="7" cy="7" r="5" />
            <path d="M2 5.2h10M2 8.8h10" />
            <ellipse cx="7" cy="7" rx="2.4" ry="5" />
          </svg>
        </IconButton>
      </Tooltip>

      <Rule orientation="vertical" className="h-4" />

      <div
        role="radiogroup"
        aria-label="Render quality"
        className="flex items-center gap-px"
      >
        {QUALITY.map((q) => (
          <Tooltip key={q.value} content={q.note}>
            <button
              type="button"
              role="radio"
              aria-checked={quality === q.value}
              aria-label={`${q.value} quality`}
              onClick={() => setQuality(q.value)}
              className={cn(
                'min-h-9 min-w-9 rounded-full px-2 text-[11px] font-semibold tracking-[0.08em] transition-colors duration-[var(--duration-instant)]',
                quality === q.value ? 'bg-surface-1 text-saffron shadow-[var(--shadow-inset)]' : 'text-ink-muted hover:text-bone',
              )}
            >
              {q.label}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
