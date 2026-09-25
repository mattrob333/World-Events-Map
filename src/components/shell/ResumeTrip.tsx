'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { resumeTarget } from '@/lib/designer/resume';
import { useDesignerStore } from '@/lib/designer/store';

/**
 * Pick up where you left off, without being taken there: the front door
 * always opens on the front door, with a slim "Continue" bar for a trip in
 * progress.
 */
export function ResumeTrip() {
  const hydrated = useHydrated();
  const pathname = usePathname() ?? '/';
  const trip = useDesignerStore((state) => state.trip);
  const [dismissed, setDismissed] = useState(false);
  const target = hydrated ? resumeTarget(trip, new Date()) : null;

  if (!target || dismissed || pathname !== '/') return null;
  return (
    <div className="border-b border-white/[0.06] bg-surface-1">
      <div className="mx-auto flex min-h-11 max-w-[1600px] items-center gap-3 px-4 py-1.5 text-[13px] sm:px-5">
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-bone">{target.title}</span>
          <span className="text-ink-subtle"> · {target.detail}</span>
        </span>
        <Link href={target.href} className="btn-primary inline-flex min-h-11 shrink-0 items-center px-4 text-[13px]">
          Continue
        </Link>
        <button type="button" onClick={() => setDismissed(true)} className="min-h-11 min-w-11 shrink-0 text-ink-subtle hover:text-bone" aria-label="Hide">
          ✕
        </button>
      </div>
    </div>
  );
}
