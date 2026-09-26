'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CategoryGlyph,
  DURATION,
  EASE_SETTLE,
  HeatDot,
  IconButton,
  PriceIndex,
  Rule,
  ScrollArea,
  Stat,
  TierMark,
  cn,
  CATEGORY_LABEL,
  HEAT_LABEL,
  HEAT_NOTE,
  TIER_NOTE,
  formatDateRange,
  formatDaysUntil,
  formatMoney,
  formatScore,
  formatTrend,
} from '@/components/ui';
import {
  CharterPanel,
  GroupList,
  PeerStack,
} from '@/components/social';
import { useEventById } from '@/lib/selectors';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import type { BuzzSignals } from '@/lib/types';
import { VenueMap } from './VenueMap';
import { PlaceGallery } from '@/components/place-media/PlaceGallery';
import { isDemoMode } from '@/lib/flags';
import { EventSaveButton } from '@/components/community/EventSaveButton';
import { getDestinationByEventId } from '@/lib/pulse';
import { EVENTS } from '@/lib/data/events';
import { daysBetween } from '@/lib/buzz/dates';
import { useTimelineStore } from '@/lib/stores/useTimelineStore';
import Link from 'next/link';

/** Plain English for the six raw signals. The engine's field names are not copy. */
const SIGNAL_LABEL: Record<keyof BuzzSignals, string> = {
  socialMentions: 'Social volume',
  socialVelocity: 'Velocity',
  searchInterest: 'Search interest',
  mediaMentions: 'Press',
  bookingPressure: 'Booking pressure',
  exclusivity: 'Exclusivity',
};

const SIGNAL_ORDER: (keyof BuzzSignals)[] = [
  'bookingPressure',
  'exclusivity',
  'socialMentions',
  'socialVelocity',
  'searchInterest',
  'mediaMentions',
];

export interface EventDossierProps {
  className?: string;
}

/**
 * The briefing.
 *
 * Laid out as a document, not a card: a masthead, a rule, then sections in the
 * order a decision actually gets made — when, why, what it is, how you get in,
 * what it costs, where you land, why the index rates it, and only then who else
 * is going.
 *
 * It occupies the left edge and stops well short of the middle. The globe is
 * still turning behind the reader and that is deliberate — this is a window
 * onto a place, not a page about one.
 */
export function EventDossier({ className }: EventDossierProps) {
  const selectedEventId = useGlobeStore((s) => s.selectedEventId);
  const select = useGlobeStore((s) => s.select);
  const event = useEventById(selectedEventId);
  // Lead time counts from the traveler's today, not from wherever a deep link
  // moved the calendar focus (red team UFR-A12).
  const today = useTimelineStore((s) => s.rangeStart);
  const leadDays = event ? daysBetween(today, event.start) : 0;
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);

  const close = useCallback(() => select(null), [select]);

  // The page also listens for Escape; this handles the case where focus has
  // moved inside the dossier, and stops the two from fighting.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    },
    [close],
  );

  useEffect(() => {
    if (!event) return;
    ref.current?.focus({ preventScroll: true });
  }, [event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const components = useMemo(() => {
    if (!event) return [];
    const c = event.buzz.components;
    const rows = SIGNAL_ORDER.map((k) => ({ key: k, value: c[k] ?? 0 }));
    const max = Math.max(...rows.map((r) => r.value), 0.001);
    return rows.map((r) => ({ ...r, ratio: r.value / max }));
  }, [event]);
  const destination = event ? getDestinationByEventId(EVENTS, event.id) : undefined;

  return (
    <AnimatePresence>
      {event && (
        <motion.article
          ref={ref}
          key={event.id}
          role="dialog"
          aria-label={`${event.name} — briefing`}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className={cn(
            // Anchored below the top chrome stack (masthead + scrubber + filters)
            // and clear of the ranked rail on the right. The centre stays open.
            // The top offset is `--chrome-h`, measured and published by the
            // shell — the scrubber collapses, so no constant could be right.
            'glass-deep fixed left-4 right-4 z-30 flex overflow-hidden lg:right-auto lg:w-[min(32rem,46vw)] lg:z-40',
            // Phone bottom nav is h-16 (4rem) plus the safe area. Keep the briefing clear of it.
            'bottom-[calc(5rem+env(safe-area-inset-bottom))] max-h-[calc(100dvh-9.5rem)] lg:bottom-4 lg:max-h-[calc(100dvh-5.5rem)]',
            'flex-col rounded-[var(--radius-card)] outline-none',
            className,
          )}
          style={{ top: '4rem' }}
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: reduced ? 0 : DURATION.considered, ease: EASE_SETTLE }}
        >
          {/* ── Masthead ─────────────────────────────────────────────── */}
          <header className="shrink-0 px-5 pb-4 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span
                    className="tabular text-[11px] leading-none text-brass"
                    title={event.providerId ? undefined : `Rank ${event.buzz.rank} in modeled demand, not a live count`}
                  >
                    {event.providerId ? 'PARTNER EVENT' : `#${event.buzz.rank} MODELED`}
                  </span>
                  <span className="h-2.5 w-px bg-ink/15" aria-hidden />
                  {!event.providerId && <TierMark tier={event.tier} withLabel size={9} />}
                  <span className="h-2.5 w-px bg-ink/15" aria-hidden />
                  <span className="flex items-center gap-1.5">
                    <CategoryGlyph category={event.category} size={11} className="text-ink-muted" />
                    <span className="label-sm text-ink-muted">
                      {CATEGORY_LABEL[event.category]}
                    </span>
                  </span>
                </div>

                <h1 className="font-display text-[27px] leading-[1.1] text-ink">
                  {event.name}
                </h1>
                <p className="text-sm leading-5 text-ink-muted">{event.tagline}</p>
              </div>

              <IconButton label="Close briefing" variant="ghost" onClick={close}>
                <svg viewBox="0 0 16 16" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" aria-hidden>
                  <path d="m4 4 8 8M12 4l-8 8" />
                </svg>
              </IconButton>
            </div>
            <Rule variant="brass" className="mt-4" />
          </header>

          <ScrollArea contentClassName="flex flex-col gap-6 px-5 pb-6">
            <PlaceGallery key={event.id} event={event} />
            <div className="grid grid-cols-2 gap-2">
              {destination && (
                <Link
                  className="btn btn-ghost col-span-2"
                  href={`/destinations/${destination.slug}`}
                >
                  Open {event.city} destination →
                </Link>
              )}
              <Link
                className="btn btn-primary px-3"
                href={destination ? `/access?destination=${encodeURIComponent(destination.slug)}` : '/access'}
              >
                Find access & stays ↗
              </Link>
              <Link
                className="btn btn-ghost px-3"
                href={destination
                  ? `/circles?destination=${encodeURIComponent(destination.slug)}&event=${encodeURIComponent(event.id)}`
                  : `/circles?event=${encodeURIComponent(event.id)}`}
              >
                Find a circle ↗
              </Link>
            </div>
            <EventSaveButton eventId={event.id} label={event.name} />
            <VenueMap event={event} />
            {/* ── When and where ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <Stat
                label="Dates"
                value={formatDateRange(event.start, event.end)}
                note={`${event.recurrence} · ${event.timezone}`}
                size="sm"
              />
              <Stat
                label="Lead time"
                value={formatDaysUntil(leadDays)}
                note={leadDays < 0 ? 'Already under way' : 'from today'}
                size="sm"
                align="end"
              />
              <Stat
                label="Where"
                value={`${event.city}, ${event.country}`}
                face="plain"
                size="sm"
              />
              <Stat
                label="Rough spend, per person"
                value={event.providerId ? 'Ask the host' : `${formatMoney(event.estimatedSpend.min)} – ${formatMoney(event.estimatedSpend.max)}`}
                note={event.providerId ? 'No estimate provided' : 'Our editorial estimate, excluding charter. Not a quote.'}
                size="sm"
                align="end"
              />
            </div>

            {/* ── Access: the thing that actually decides it ──────────── */}
            <Section label="Access">
              <div className="surface-well px-4 py-3.5">
                <p className="font-display text-[15px] leading-[1.45] text-ink">
                  {event.accessNote}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-ink-muted">
                  {event.providerId ? 'Approved submission · confirm access and availability with the host' : TIER_NOTE[event.tier]}
                </p>
              </div>
            </Section>

            {/* ── Why go ─────────────────────────────────────────────── */}
            <Section label="Why go">
              <ul className="flex flex-col gap-2.5">
                {event.whyGo.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-brass-deep" />
                    <span className="text-[13px] leading-[1.55] text-ink-soft">{line}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* ── The read ───────────────────────────────────────────── */}
            <Section label="The read">
              <p className="text-[13px] leading-[1.65] text-ink-muted">
                {event.description}
              </p>
            </Section>

            {/* ── Ground ─────────────────────────────────────────────── */}
            <Section label="Venues">
              <ul className="flex flex-col gap-1.5">
                {event.venues.length ? event.venues.map((v) => (
                  <li key={v} className="text-[13px] leading-5 text-ink-soft">
                    {v}
                  </li>
                )) : <li className="text-[13px] leading-5 text-ink-muted">Venue to be announced by the organizer</li>}
              </ul>
            </Section>

            <Section label={event.providerId ? 'Closest indexed airport · verify routing' : 'Nearest jet port'}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="tabular text-[13px] leading-none text-ink">
                    {event.nearestJetPort.code}
                  </span>
                  <span className="truncate text-[11px] leading-4 text-ink-muted">
                    {event.nearestJetPort.name}
                  </span>
                </div>
                <span className="label-sm shrink-0 text-ink-muted">
                  Private-jet facilities: {event.nearestJetPort.fboQuality} (editorial rating)
                </span>
              </div>
            </Section>

            {!event.providerId && <Section label="Spend index">
              <PriceIndex value={event.priceIndex} size={12} withLabel />
            </Section>}

            {/* ── Why the index rates it ─────────────────────────────── */}
            {!event.providerId && <Section label="Modeled interest">
              <div className="flex items-end justify-between gap-4 pb-3">
                <div className="flex items-baseline gap-2.5">
                  <HeatDot heat={event.buzz.heat} size="md" glow />
                  <span className="tabular text-[24px] leading-none text-ink">
                    {formatScore(event.buzz.score)}
                  </span>
                  <span className="label-sm text-ink-muted">
                    {HEAT_LABEL[event.buzz.heat]}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="label-sm text-ink-muted">Momentum</span>
                  <span className="tabular text-[12px] leading-none text-ink">
                    {formatTrend(event.buzz.trend)}
                  </span>
                </div>
              </div>

              <p className="pb-3 text-[11px] leading-4 text-ink-muted">
                {HEAT_NOTE[event.buzz.heat]}. Modeled from our curated calendar, refreshed by live
                signals only where they&rsquo;re connected; not live booking data. Bars are each
                signal&rsquo;s weighted contribution to the score.
              </p>

              <ul className="flex flex-col gap-2">
                {components.map(({ key, value, ratio }) => (
                  <li key={key} className="flex items-center gap-3">
                    <span className="label-sm w-28 shrink-0 text-ink-muted">
                      {SIGNAL_LABEL[key]}
                    </span>
                    <span
                      className="h-px min-w-0 flex-1 bg-ink/10"
                      role="img"
                      aria-label={`${SIGNAL_LABEL[key]} contributes ${value.toFixed(1)} points`}
                    >
                      <span
                        className="block h-px bg-brass"
                        style={{ width: `${Math.max(1, ratio * 100)}%` }}
                      />
                    </span>
                    <span className="tabular w-9 shrink-0 text-right text-[11px] leading-none text-ink">
                      {value.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>

              {event.buzz.peerLift !== undefined && (
                <p className="mt-3 text-[11px] leading-4 text-signal">
                  Simulated member interest lifted this score by {event.buzz.peerLift.toFixed(1)}.
                </p>
              )}
            </Section>}

            {event.tags.length > 0 && (
              <Section label="Tags">
                <p className="text-[11px] leading-5 text-ink-muted">
                  {event.tags.join(' · ')}
                </p>
              </Section>
            )}

            {/* ── Who else ───────────────────────────────────────────── */}
            <Rule variant="brass" />

            {isDemoMode() && <Section label="Simulated: members overlapping">
              <PeerStack eventId={event.id} limit={12} />
            </Section>}

            {isDemoMode() && <Section label="Simulated: groups forming">
              <GroupList eventId={event.id} />
            </Section>}

            {isDemoMode() && !event.providerId && <Section label="Charter · planning estimates">
              <CharterPanel eventId={event.id} />
            </Section>}
          </ScrollArea>
        </motion.article>
      )}
    </AnimatePresence>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="eyebrow shrink-0">{label}</h2>
        <Rule variant="ghost" />
      </div>
      {children}
    </section>
  );
}
