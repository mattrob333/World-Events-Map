'use client';

import { useMemo } from 'react';
import { pickActiveProfile, useDesignerStore } from '@/lib/designer/store';
import type { PlanPlace } from '@/lib/search/planPlace';
import { withTaste } from '@/lib/vibe/affinity';
import type { NewsStatus, VibePlace } from '@/lib/vibe/match';
import type { TripWindow } from '@/lib/vibe/window';

export type VibePayload = {
  window: TripWindow;
  places: VibePlace[];
  alsoInRange: { key: string; name: string; country: string }[];
  news: NewsStatus;
};

const short = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** Where to plan: the place, with the window's dates (at most 14 nights). */
function planFor(place: { name: string; country: string }, window: TripWindow): PlanPlace {
  const nights = Math.max(1, Math.min(14, window.days - 1));
  return { place: place.name, region: place.country, start: window.from, nights };
}

/**
 * Vibe Match results: places ranked by what's on for the dates, what the
 * news is counting, and the traveler's own taste (added here, on the device).
 * Every reason shows where it came from; nothing is scored that wasn't counted.
 */
export function VibePlaces({ vibe, onPlan, onSee }: { vibe: VibePayload; onPlan: (plan: PlanPlace) => void; onSee: (href: string) => void }) {
  const profiles = useDesignerStore((s) => s.profiles);
  const activeProfileId = useDesignerStore((s) => s.activeProfileId);
  const profile = pickActiveProfile(profiles, activeProfileId)?.profile;
  const ranked = useMemo(() => withTaste(vibe.places, profile).slice(0, 5), [vibe.places, profile]);
  const { window, news } = vibe;

  const newsLine = news.state === 'ok'
    ? `Counting ${news.stories.toLocaleString('en-US')} travel stories${news.since ? ` since ${short(news.since.slice(0, 10))}` : ''}.`
    : news.state === 'empty' ? 'The news signal is still collecting its first stories.' : 'The news signal is unavailable right now, so this uses the calendar only.';

  return (
    <div className="mt-3 flex flex-col gap-3">
      <p className="text-[15px] text-ink-soft">
        Your window: <span className="text-bone">{short(window.from)} – {short(window.to)}</span>
        {window.exact ? '' : ' (whole period; name a week to narrow it)'}
      </p>
      {ranked.length ? ranked.map((place, index) => (
        <article key={place.key} className="rounded-[20px] bg-surface-1/80 p-4">
          <div className="flex items-baseline gap-3">
            <span aria-hidden="true" className="font-display text-[28px] leading-none text-ink-faint">{index + 1}</span>
            <h3 className="min-w-0 flex-1 font-display text-[24px] leading-tight text-bone">
              {place.name}<span className="text-ink-soft">, {place.country}</span>
            </h3>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {place.reasons.slice(0, 3).map((reason) => (
              <li key={`${reason.kind}:${reason.text}`} className="text-[14px] leading-snug">
                <span className={reason.kind === 'taste' ? 'text-saffron' : reason.kind === 'caveat' ? 'text-ink-muted' : 'text-bone'}>{reason.text}</span>
                <span className="mt-0.5 block text-[11.5px] text-ink-subtle">
                  {reason.sources.slice(0, 3).map((source, i) => (
                    <span key={`${source.label}${i}`}>
                      {i ? ' · ' : ''}
                      {source.url ? <a className="underline underline-offset-2" href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a> : source.label}
                      {source.date ? ` ${short(source.date)}` : ''}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className={index === 0 ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => onPlan(planFor(place, window))}>Plan this</button>
            {place.slug && (
              <button type="button" className="min-h-11 px-2 text-[13px] text-ink-muted underline underline-offset-4 hover:text-bone" onClick={() => onSee(`/destinations/${place.slug}${place.events[0] ? `?event=${encodeURIComponent(place.events[0].id)}` : ''}`)}>
                See the place
              </button>
            )}
          </div>
        </article>
      )) : (
        <p className="text-[15px] text-ink-soft">Nothing on our calendar or in the news fits those dates there yet.</p>
      )}
      {vibe.alsoInRange.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Also in range · nothing dated or in the news yet</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vibe.alsoInRange.slice(0, 12).map((place) => (
              <button key={place.key} type="button" className="chip min-h-9" onClick={() => onPlan(planFor(place, window))}>{place.name}</button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[12px] leading-4 text-ink-subtle">
        Ranked by what’s on for your dates (dope.travel calendar), what the news is counting, and {profile ? 'your vibe (matched on this device)' : 'nothing personal yet: set your vibe to add your taste'}. {newsLine}
      </p>
    </div>
  );
}
