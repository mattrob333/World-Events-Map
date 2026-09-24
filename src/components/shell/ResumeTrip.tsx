'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { isDemoMode } from '@/lib/flags';
import { resumeTarget } from '@/lib/designer/resume';
import { useDesignerStore } from '@/lib/designer/store';

const SESSION_KEY = 'dope.resume.v1';

function readFlag(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeFlag(value: string) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    // Private mode: the bar still works, it just may auto-open again.
  }
}

/**
 * Pick up where you left off. The first time the front door opens in a
 * browser session with a trip in progress, it goes straight to that trip,
 * with a one-tap way back to the globe. After that, the front door shows a
 * slim "continue" bar instead.
 */
export function ResumeTrip() {
  const hydrated = useHydrated();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const trip = useDesignerStore((state) => state.trip);
  const [flag, setFlag] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const target = hydrated ? resumeTarget(trip, new Date()) : null;

  useEffect(() => {
    if (!hydrated) return;
    const seen = readFlag();
    if (!seen && target && pathname === '/' && !window.location.search && !window.location.hash && !isDemoMode()) {
      writeFlag('opened');
      router.replace(target.href);
      return;
    }
    if (!seen) writeFlag('seen');
    const current = readFlag();
    const timer = window.setTimeout(() => setFlag(current), 0);
    return () => window.clearTimeout(timer);
    // Runs once per page view; the target is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, pathname]);

  if (!target || dismissed) return null;

  if (flag === 'opened' && pathname === target.href) {
    return (
      <div className="border-b border-white/[0.06] bg-surface-1">
        <div className="mx-auto flex min-h-11 max-w-[1600px] flex-wrap items-center gap-x-3 px-4 py-1.5 text-[13px] sm:px-5">
          <span className="text-ink-soft">Picked up where you left off.</span>
          <Link
            href="/"
            onClick={() => {
              writeFlag('seen');
              setDismissed(true);
            }}
            className="inline-flex min-h-11 items-center text-saffron hover:underline"
          >
            Go to the globe instead
          </Link>
        </div>
      </div>
    );
  }

  if (pathname !== '/') return null;
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
