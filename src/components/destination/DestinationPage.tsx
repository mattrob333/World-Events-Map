'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Chip, EmptyState, Panel, cn, formatDateRange } from '@/components/ui';
import { FixtureBanner, IntentBar, OpportunityCardView, ProvenanceNote } from '@/components/shell';
import { EVENTS, EVENT_INDEX } from '@/lib/data/events';
import { getDestinationBySlug, STATUS_LABEL, type DestinationPulse } from '@/lib/pulse';
import { listInspiration, INSPIRATION_FIXTURE_DISCLOSURE, INSPIRATION_KIND_LABEL } from '@/lib/inspiration';
import { listOpportunities, ACCESS_FIXTURE_DISCLOSURE } from '@/lib/access';
import { listTravelersForDestination, TRAVELER_FIXTURE_DISCLOSURE } from '@/lib/travelers';
import { listTripRoomsForDestination } from '@/lib/trips';
import { track } from '@/lib/analytics';
import { todayISO } from '@/lib/buzz/dates';
import { Avatar } from '@/components/social';

const TABS = ['pulse', 'happening', 'people', 'inspiration', 'access'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  pulse: 'Pulse',
  happening: 'Happening',
  people: 'People',
  inspiration: 'Inspiration',
  access: 'Stay / Access',
};

export function DestinationPage({ slug }: { slug: string }) {
  const [tab, setTab] = useState<Tab>('pulse');
  const pulse = useMemo(
    () => getDestinationBySlug(EVENTS, slug, todayISO()),
    [slug],
  );

  useEffect(() => {
    if (pulse) track('destination_opened', { slug: pulse.slug });
  }, [pulse]);

  if (!pulse) {
    return (
      <main className="px-4 py-16 sm:px-8">
        <EmptyState
          title="That destination is not on the calendar."
          body="MERIDIAN destinations are built from curated occasions. Search for a city that is actually on the board."
          action={
            <Link href="/" className="text-[12px] text-brass">
              Return to World
            </Link>
          }
        />
      </main>
    );
  }

  return <DestinationLoaded pulse={pulse} tab={tab} onTab={setTab} />;
}

function DestinationLoaded({
  pulse,
  tab,
  onTab,
}: {
  pulse: DestinationPulse;
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const events = pulse.eventIds
    .map((id) => EVENT_INDEX.get(id))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const inspiration = listInspiration(pulse.id);
  const offers = listOpportunities(pulse.id);
  const people = listTravelersForDestination(pulse.id);
  const rooms = listTripRoomsForDestination(pulse.id);
  const startHref = rooms[0]
    ? `/circles/${rooms[0].id}`
    : `/circles?destination=${pulse.slug}`;

  return (
    <main className="px-4 pb-20 pt-6 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <header className="min-w-0">
          <p className="label-sm text-brass">{pulse.country}</p>
          <h1 className="mt-2 font-display text-[clamp(3rem,8vw,6.5rem)] leading-[0.9] tracking-[-0.03em] text-ink">
            {pulse.name}
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-6 text-ink-muted">{pulse.whyNow}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="label border border-heat-hot/40 bg-heat-hot/10 px-2 py-1 text-heat-hot">
              {STATUS_LABEL[pulse.status]}
            </span>
            {pulse.archetypes.map((archetype) => (
              <Chip key={archetype} readOnly>
                {archetype}
              </Chip>
            ))}
          </div>
          <IntentBar
            className="mt-6"
            kind="destination"
            id={pulse.slug}
            label={pulse.name}
            href={`/destinations/${pulse.slug}`}
            startHref={startHref}
          />
        </header>
        <aside className="glass relative min-h-56 overflow-hidden rounded-[3px] p-5">
          <p className="label-sm text-ink-muted">Heat</p>
          <p className="mt-3 font-display text-6xl text-ink">{pulse.score}</p>
          <p className="mt-2 text-[12px] text-ink-muted">
            Modeled destination score from the lead occasion. Not live attendance.
          </p>
          <ProvenanceNote className="mt-6" kind="modeled_demand">
            {`Updated from the curated calendar${pulse.updatedAt.startsWith('20') ? ` · ${pulse.updatedAt.slice(0, 10)}` : '.'}`}
          </ProvenanceNote>
        </aside>
      </div>

      <div className="mt-10 flex gap-1 overflow-x-auto border-b border-ink/10 pb-px">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={cn(
              'label shrink-0 px-3 py-3 text-ink-muted hover:text-ink',
              tab === item && 'text-brass border-b border-brass',
            )}
            onClick={() => onTab(item)}
          >
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>

      <section className="mt-8">
        {tab === 'pulse' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Why now" accent>
              <ol className="flex flex-col gap-4">
                {pulse.reasons.map((reason) => (
                  <li key={reason.id}>
                    <p className="text-[14px] text-ink">{reason.text}</p>
                    <ProvenanceNote className="mt-1" kind={reason.provenance} />
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel title="Signals">
              <dl className="grid gap-4">
                {Object.entries(pulse.signals).map(([key, fact]) =>
                  fact ? (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <div>
                        <dt className="label-sm text-ink-muted">{fact.label}</dt>
                        <dd className="mt-1 text-[13px] text-ink-muted">{fact.note}</dd>
                      </div>
                      <p className="tabular text-[18px] text-ink">
                        {Math.round(fact.value)}
                        {fact.direction === 'up' ? ' ↑' : fact.direction === 'down' ? ' ↓' : ''}
                      </p>
                    </div>
                  ) : null,
                )}
              </dl>
            </Panel>
          </div>
        )}

        {tab === 'happening' && (
          <div className="grid gap-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/?event=${event.id}`}
                className="glass flex flex-col gap-1 rounded-[3px] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="label-sm text-brass">{event.category}</p>
                  <p className="font-display text-[22px] text-ink">{event.name}</p>
                  <p className="text-[12px] text-ink-muted">{event.tagline}</p>
                </div>
                <p className="text-[12px] text-ink-muted">{formatDateRange(event.start, event.end)}</p>
              </Link>
            ))}
          </div>
        )}

        {tab === 'people' && (
          <div className="grid gap-4">
            <FixtureBanner>{TRAVELER_FIXTURE_DISCLOSURE}</FixtureBanner>
            <EmptyState
              title="No live travelers are listed here."
              body="Public member interest is private by default. Editorial portraits below are layout examples only."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((portrait) => (
                <Link
                  key={portrait.person.handle}
                  href={`/people/${portrait.person.handle}`}
                  className="glass flex items-center gap-3 rounded-[3px] p-4"
                >
                  <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">{portrait.person.displayName}</p>
                    <p className="truncate text-[11px] text-ink-muted">
                      @{portrait.person.handle} · {portrait.featuredModes[0]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            {rooms.length > 0 && (
              <Panel title="Sample trip rooms">
                {rooms.map((room) => (
                  <Link key={room.id} href={`/circles/${room.id}`} className="block py-2 text-[13px] text-brass">
                    {room.name} →
                  </Link>
                ))}
              </Panel>
            )}
          </div>
        )}

        {tab === 'inspiration' && (
          <div className="grid gap-4">
            <FixtureBanner>{INSPIRATION_FIXTURE_DISCLOSURE}</FixtureBanner>
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
              {inspiration.map((item) => (
                <article key={item.id} className="glass mb-3 break-inside-avoid rounded-[3px] p-4">
                  <p className="label-sm text-brass">{INSPIRATION_KIND_LABEL[item.kind]}</p>
                  <h3 className="mt-2 font-display text-[22px] text-ink">{item.title}</h3>
                  {item.subtitle && <p className="mt-1 text-[12px] text-ink-muted">{item.subtitle}</p>}
                  <p className="mt-3 text-[11px] text-ink-muted">
                    Must {item.votes.mustDo} · Maybe {item.votes.maybe} · Skip {item.votes.skip}
                  </p>
                </article>
              ))}
            </div>
            {inspiration.length === 0 && (
              <EmptyState title="No editorial board for this place yet." body="Start a Circle to collect restaurants, stays and notes." />
            )}
          </div>
        )}

        {tab === 'access' && (
          <div className="grid gap-4">
            <FixtureBanner>{ACCESS_FIXTURE_DISCLOSURE}</FixtureBanner>
            <div className="grid gap-3 lg:grid-cols-2">
              {offers.map((offer) => (
                <OpportunityCardView key={offer.id} offer={offer} />
              ))}
            </div>
            {offers.length === 0 && (
              <EmptyState
                title="No partner opportunities mapped here yet."
                body="ACCESS stays inquiry-first. When a provider publishes against this destination, it will appear here."
              />
            )}
          </div>
        )}
      </section>

      <div className="sticky bottom-20 z-20 mt-10 flex justify-end md:bottom-6">
        <Link
          href={startHref}
          className="inline-flex h-10 items-center rounded-[2px] border border-commit/50 bg-void/90 px-5 label text-commit shadow-lg"
        >
          Start a trip
        </Link>
      </div>
    </main>
  );
}
