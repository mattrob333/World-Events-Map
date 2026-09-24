'use client';

import Link from 'next/link';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { formatDateRange } from '@/components/ui';
import { EVENTS } from '@/lib/data/events';
import { useIntentStore } from '@/lib/intent';
import { IDEA_INTERESTS, recommendTravelIdeas, type IdeaInterest, type TravelIdea } from '@/lib/ideas-preview/recommend';
import { calendarDateInTimeZone } from '@/lib/stores/useTimelineStore';

const noSubscribe = () => () => {};
const currentDay = () => calendarDateInTimeZone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
const previewDay = () => '2026-09-22';
const clientReady = () => true;
const serverReady = () => false;

export function IdeasRail() {
  const [interest, setInterest] = useState<IdeaInterest>('all');
  const today = useSyncExternalStore(noSubscribe, currentDay, previewDay);
  const hydrated = useSyncExternalStore(noSubscribe, clientReady, serverReady);
  const items = useIntentStore((state) => state.items);
  const toggle = useIntentStore((state) => state.toggle);

  const ideas = useMemo(() => recommendTravelIdeas(EVENTS, today, interest), [today, interest]);
  const activity = hydrated ? [...items].reverse().slice(0, 3) : [];

  return (
    <aside className="min-w-0 space-y-4" aria-label="Travel ideas and your activity">
      <section className="surface overflow-hidden">
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">The next possibility</p>
              <h2 className="mt-2 font-display text-[30px] leading-none tracking-[-0.025em] text-ink">Travel ideas</h2>
            </div>
            <span className="text-xl text-brass" aria-hidden="true">✳</span>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-ink-muted">An editorial shortlist from the curated calendar. Choose a mood to change the places below.</p>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose a travel interest">
            {IDEA_INTERESTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={interest === option.id}
                onClick={() => setInterest(option.id)}
                className="chip"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 px-3 pb-3">
          {ideas.length ? ideas.map((idea, index) => (
            <IdeaCard
              key={idea.eventId}
              idea={idea}
              index={index}
              saved={hydrated && items.some((item) => item.verb === 'save' && item.kind === 'destination' && item.id === idea.slug)}
              watched={hydrated && items.some((item) => item.verb === 'watch' && item.kind === 'destination' && item.id === idea.slug)}
              onToggle={(verb) => toggle({ verb, kind: 'destination', id: idea.slug, label: idea.destination, href: `/destinations/${idea.slug}` })}
            />
          )) : (
            <p className="px-2 py-6 text-[13px] leading-5 text-ink-muted">No upcoming occasion in this part of the curated calendar. Try another interest.</p>
          )}
        </div>
        <div className="px-5 pb-4 text-[11px] leading-4 text-ink-subtle">Suggestions are deterministic editorial picks, not personalized AI or live availability.</div>
      </section>

      <section className="surface px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="eyebrow">Your trail</p>
            <h2 className="mt-1 font-display text-[23px] leading-tight text-ink">Saved activity</h2>
          </div>
          <Link href="/circles" className="btn btn-ghost btn-sm">Explore Circles ↗</Link>
        </div>
        {activity.length ? (
          <ul className="mt-4 space-y-2">
            {activity.map((item) => (
              <li key={`${item.verb}:${item.kind}:${item.id}`} className="flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-surface-1 px-3 text-[13px]">
                <span className="tag min-w-12 justify-center text-saffron">{item.verb === 'idGo' ? "I'd go" : item.verb}</span>
                <Link href={item.href} className="min-w-0 truncate text-ink hover:text-brass">{item.label}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] leading-5 text-ink-muted">Save a place to begin your shortlist. Your choices stay on this device.</p>
        )}
        <p className="mt-3 text-[11px] leading-4 text-ink-subtle">Watch is a local return list. It does not send notifications.</p>
      </section>
    </aside>
  );
}

function IdeaCard({ idea, index, saved, watched, onToggle }: {
  idea: TravelIdea;
  index: number;
  saved: boolean;
  watched: boolean;
  onToggle: (verb: 'save' | 'watch') => void;
}) {
  return (
    <article className="rounded-[var(--radius-control)] bg-surface-1/60 px-3 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 font-display text-[18px] text-saffron shadow-soft-1">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">{idea.country} · {formatDateRange(idea.start, idea.end)}</p>
          <Link href={`/destinations/${idea.slug}`} className="mt-1 block font-display text-[24px] leading-tight text-ink hover:text-brass">{idea.destination} <span aria-hidden="true" className="text-[15px] text-brass">↗</span></Link>
          <p className="mt-1 text-[13px] leading-5 text-ink-muted">{idea.eventName}</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-ink-soft">{idea.tagline}</p>
          <details className="group mt-3">
            <summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-[13px] text-brass-bright marker:hidden hover:text-bone">Why this trip <span className="inline-block transition-transform group-open:rotate-45">＋</span></summary>
            <div className="notice mt-2 text-[12px] leading-5">
              <p>Curated occasion: {idea.eventName}.</p>
              {idea.whyGo.map((reason) => <p key={reason}>• {reason}</p>)}
              {idea.relatedOccasions > 1 && <p>{idea.relatedOccasions} occasions are indexed for {idea.destination}.</p>}
              <p className="mt-1 text-ink-subtle">Dates and reasons come from dope.travel&apos;s editorial calendar.</p>
            </div>
          </details>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={saved} onClick={() => onToggle('save')} className="chip">{saved ? 'Saved ✓' : 'Save'}</button>
            <button type="button" aria-pressed={watched} title="Local return list; no notifications" onClick={() => onToggle('watch')} className="chip">{watched ? 'Watching ✓' : 'Watch'}</button>
            <Link href={`/circles?destination=${encodeURIComponent(idea.slug)}`} className="btn btn-ghost btn-sm">Start Circle ↗</Link>
          </div>
        </div>
      </div>
    </article>
  );
}
