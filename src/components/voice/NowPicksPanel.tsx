'use client';

import Link from 'next/link';
import { SourceLogo } from '@/components/brand/SourceLogo';
import { formatMiles } from '@/lib/units';
import type { NowFound } from './useNowFinder';

const pretty = (category: string) => category.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** Vibe Now's answer: the best few places open near them right now, best first. */
export function NowPicksPanel({ found }: { found: NowFound }) {
  if (found.status === 'idle') return null;
  if (found.status === 'loading') {
    return <p className="mt-4 text-[14px] text-ink-soft" aria-live="polite">{found.ask.where ? `Checking what’s busy near ${found.ask.where}…` : 'Checking what’s busy around you…'}</p>;
  }
  if (found.status === 'error') return <p className="notice mt-4 text-[13.5px]" role="status">{found.message}</p>;
  const { picks, place, basis } = found;
  return (
    <section className="mt-4" aria-label="Open and busy near you" aria-live="polite">
      <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-saffron">{place === 'you' ? 'Near you, right now' : `Near ${place}, right now`}</p>
      {picks.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink-soft">Nothing open with a foot-traffic reading nearby this hour. Try something else, or a wider area on the busy map.</p>
      ) : (
        <ol className="mt-2 grid gap-2">
          {picks.map((pick, index) => (
            <li key={pick.id} className="rounded-2xl bg-surface-1/90 p-3 shadow-soft-1">
              <div className="flex items-start gap-3">
                <span className="w-6 shrink-0 text-center font-display text-[22px] leading-none text-saffron">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15.5px] font-semibold text-bone">{pick.name}</p>
                  <p className="text-[12.5px] text-ink-muted">{pretty(pick.category)}{pick.distanceMeters !== undefined ? ` · ${formatMiles(pick.distanceMeters / 1000)}` : ''}{pick.closes ? ` · ${pick.closes}` : ''}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                      <i className="block h-full rounded-full bg-gradient-to-r from-saffron via-tangerine to-flamingo" style={{ width: `${pick.busyness}%` }} />
                    </span>
                    <span className="text-[12px] font-semibold text-bone">{pick.busyness}%{pick.basis === 'live' ? <span className="text-flamingo"> live</span> : null}</span>
                  </div>
                  {pick.wink && <p className="mt-1.5 text-[13px] font-medium text-saffron">{pick.wink}</p>}
                </div>
                <a
                  className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[12.5px] font-semibold text-bone hover:bg-surface-3"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${pick.name} ${pick.address ?? ''}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Directions to ${pick.name}`}
                >
                  <SourceLogo source="google maps" size={14} />Go
                </a>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11.5px] leading-snug text-ink-subtle">
        Foot traffic from BestTime, {basis === 'live' ? 'live now' : basis === 'mixed' ? 'live where marked, else the usual for this hour' : 'the usual for this hour'}; closing times from its listed hours, so check before you go.{found.ask.where ? ' Place search © OpenStreetMap.' : ''}{' '}
        <Link href="/nearby" className="font-semibold text-saffron underline underline-offset-2">See the busy map</Link>
      </p>
    </section>
  );
}
