'use client';

import Link from 'next/link';
import { FEATURES } from '@/lib/flags';
import { useMemo, useState } from 'react';
import { Button, EmptyState, Panel, cn, formatDateRange } from '@/components/ui';
import { OpportunityCardView } from '@/components/shell';
import {
  INSPIRATION_FIXTURE_DISCLOSURE,
  INSPIRATION_KIND_LABEL,
  listInspiration,
  type InspirationVote,
} from '@/lib/inspiration';
import { ACCESS_FIXTURE_DISCLOSURE, listOpportunities } from '@/lib/access';
import {
  TRIP_ROOM_DISCLOSURE,
  TRIP_ROOM_FIXTURES,
  getTripRoom,
  listTripRoomsForSlug,
  type TripRoomFixture,
} from '@/lib/trips';
import { getTraveler, TRAVELER_PORTRAITS } from '@/lib/travelers';
import { getDestinationBySlug } from '@/lib/pulse';
import { EVENTS, EVENT_INDEX } from '@/lib/data/events';
import { todayISO } from '@/lib/buzz/dates';
import { Avatar } from '@/components/social';
import { track } from '@/lib/analytics';
import { getPlatformClient } from '@/lib/platform/client';

const TABS = ['overview', 'inspiration', 'plan', 'people', 'access', 'chat'] as const;
type Tab = (typeof TABS)[number];

export function CirclesIndex({ destination, eventId }: { destination?: string; eventId?: string }) {
  const slug = typeof destination === 'string' ? destination.trim().toLowerCase() : '';
  const requestedEventId = typeof eventId === 'string' ? eventId.trim() : '';
  const pulse = slug ? getDestinationBySlug(EVENTS, slug, todayISO()) : undefined;
  const selectedEvent = pulse && pulse.eventIds.includes(requestedEventId)
    ? EVENT_INDEX.get(requestedEventId)
    : undefined;
  const matching = slug ? listTripRoomsForSlug(slug) : [];
  const rest = slug
    ? TRIP_ROOM_FIXTURES.filter((trip) => trip.destinationSlug !== slug)
    : TRIP_ROOM_FIXTURES;
  const placeName = pulse?.name ?? slug;
  const membershipConfigured = Boolean(getPlatformClient());

  return (
    <main className="px-4 py-10 sm:px-8">
      <p className="eyebrow">Circles</p>
      <h1 className="mt-3 font-display text-5xl text-ink">Trip rooms</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-ink-muted">
        A Circle is a trip, not a chat thread. Live Circles still live in Community for members who are signed in.
      </p>
      {selectedEvent && <section className="surface-hero mt-8 px-6 py-6">
        <p className="eyebrow">Your selected occasion · curated calendar</p>
        <h2 className="mt-2 font-display text-3xl text-ink">{selectedEvent.name}</h2>
        <p className="mt-2 font-mono text-[13px] text-ink-soft">{selectedEvent.city}, {selectedEvent.country} · {formatDateRange(selectedEvent.start, selectedEvent.end)}</p>
        <p className="mt-3 max-w-2xl text-[13px] leading-5 text-ink-muted">This is the occasion you chose to plan around. No Circle or booking has been created. Confirm the event dates and access with the organizer before committing travel.</p>
        {membershipConfigured ? <>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Link href={`/community?event=${encodeURIComponent(selectedEvent.id)}`} className="btn btn-primary">Continue in Community to start a real Circle ↗</Link>
            <Link href={`/?event=${encodeURIComponent(selectedEvent.id)}`} className="btn btn-ghost">Review event details ↗</Link>
          </div>
          <p className="mt-3 text-[12px] text-ink-subtle">Community requires a connected membership. Enter your travel dates in its Circle form; they are not prefilled here.</p>
        </> : <>
          {/* No glowing primary into a flow that cannot finish (design rule 9, UFR2-J03). */}
          <p className="notice mt-4 max-w-2xl px-4 py-3 text-[13px] leading-5 text-ink-muted" role="note">
            Shared Circles need membership, which is not connected on this preview. You can still plan {selectedEvent.city} on this device in the trip designer.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link href={`/trips/designer?${new URLSearchParams({ place: selectedEvent.city, region: selectedEvent.country }).toString()}`} className="btn btn-ghost">Plan {selectedEvent.city} in the trip designer ↗</Link>
            <Link href={`/?event=${encodeURIComponent(selectedEvent.id)}`} className="btn btn-ghost">Review event details ↗</Link>
          </div>
        </>}
      </section>}
      {slug ? (
        <section className="notice mt-8 p-5">
          <p className="eyebrow">Exploring {placeName}</p>
          {matching.length === 0 ? (
            <p className="mt-2 max-w-xl text-[13px] text-ink-muted">
              No sample trip room for this destination yet. Live Circles still live in Community
              for members — this preview does not invent a new Circle.
            </p>
          ) : (
            <p className="mt-2 max-w-xl text-[13px] text-ink-muted">
              The sample rooms below are separate example trips. Their events and dates may differ from your selected occasion.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2.5">
            {pulse ? (
              <Link href={`/destinations/${pulse.slug}`} className="btn btn-ghost btn-sm min-h-11">
                Back to {pulse.name}
              </Link>
            ) : null}
            {membershipConfigured && FEATURES.circles ? <Link href={selectedEvent ? `/community?event=${encodeURIComponent(selectedEvent.id)}` : '/community'} className="btn btn-ghost btn-sm min-h-11">
              {selectedEvent ? 'Find real Circles for this event' : 'Open Community Circles'}
            </Link> : null}
          </div>
        </section>
      ) : null}
      <p role="note" className="notice mt-6 max-w-3xl">{TRIP_ROOM_DISCLOSURE}</p>
      {matching.length > 0 ? (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-2xl text-ink">Other sample trips in {placeName}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
          {matching.map((trip) => (
            <TripRoomCard key={trip.id} trip={trip} />
          ))}
          </div>
        </div>
      ) : null}
      <h2 className="mt-10 font-display text-2xl text-ink">More sample trip rooms</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {rest.map((trip) => (
          <TripRoomCard key={trip.id} trip={trip} />
        ))}
      </div>
      <p className="mt-8 text-[14px] text-ink-muted">
        Already a member?{' '}
        <Link href="/community" className="text-brass-bright underline underline-offset-4">
          Open live Circles
        </Link>
        .
      </p>
    </main>
  );
}

function TripRoomCard({
  trip,
  highlight,
}: {
  trip: TripRoomFixture;
  highlight?: boolean;
}) {
  return (
    <Link
      href={`/circles/${trip.id}`}
      className={cn('surface transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-surface-3 hover:shadow-[var(--shadow-soft-2)] active:translate-y-px active:shadow-[var(--shadow-inset)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none flex flex-col p-6', highlight && 'shadow-[var(--shadow-soft-1),inset_0_0_0_1px_rgb(247_197_72/0.4)]')}
    >
      <p className="eyebrow">{trip.destinationLabel}</p>
      <h2 className="mt-3 font-display text-3xl text-ink">{trip.name}</h2>
      <p className="mt-2 font-mono text-[13px] text-ink-soft">
        {formatDateRange(trip.start, trip.end)} · {trip.travelMode}
      </p>
      <p className="mt-4 text-[14px] leading-6 text-ink-muted">{trip.nextDecision}</p>
    </Link>
  );
}

export function TripRoom({ id }: { id: string }) {
  const trip = getTripRoom(id);
  const [tab, setTab] = useState<Tab>('overview');
  const [votes, setVotes] = useState<Record<string, InspirationVote>>({});
  const pulse = trip
    ? getDestinationBySlug(EVENTS, trip.destinationSlug, todayISO())
    : undefined;
  const board = useMemo(
    () => (trip ? listInspiration(trip.destinationId) : []),
    [trip],
  );
  const offers = trip ? listOpportunities(trip.destinationId) : [];

  if (!trip) {
    return (
      <main className="px-4 py-16">
        <EmptyState
          title="This trip room is not on the preview board."
          body="Sample rooms exist for Aspen and Monte-Carlo. Live Circles remain under Community."
          action={
            <Link href="/trips" className="btn btn-ghost">
              Your trips
            </Link>
          }
        />
      </main>
    );
  }

  const members = trip.memberHandles
    .map((handle) => getTraveler(handle) ?? TRAVELER_PORTRAITS.find((p) => p.person.handle === handle))
    .filter(Boolean);

  const mustDos = board.filter((item) => item.votes.mustDo >= 3 || votes[item.id] === 'mustDo');

  return (
    <main className="px-4 pb-20 pt-6 sm:px-8">
      <p role="note" className="notice">{TRIP_ROOM_DISCLOSURE}</p>
      <header className="surface-hero mt-6 flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">
            {trip.destinationLabel} · {trip.travelMode}
          </p>
          <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95] text-ink">
            {trip.name}
          </h1>
          <p className="mt-3 font-mono text-[13px] text-ink-soft">
            {formatDateRange(trip.start, trip.end)} · {trip.status}
          </p>
        </div>
        <div className="flex -space-x-2">
          {members.map((portrait) =>
            portrait ? (
              <Avatar
                key={portrait.person.handle}
                seed={portrait.person.avatarSeed}
                name={portrait.person.displayName}
                size={36}
              />
            ) : null,
          )}
        </div>
      </header>

      <div className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0" role="tablist" aria-label="Trip room sections">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`chip min-h-11 shrink-0 px-4 text-[14px] capitalize ${tab === item ? 'chip-on' : ''}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Panel title="Dates" accent>
            <p className="font-display text-2xl leading-tight text-ink sm:text-3xl">{formatDateRange(trip.start, trip.end)}</p>
            <p className="mt-3 text-[13px] text-ink-muted">{trip.nextDecision}</p>
          </Panel>
          <Panel title="Destination pulse">
            <p className="font-display text-4xl">{pulse?.score ?? '—'}</p>
            <p className="mt-2 text-[13px] text-ink-muted">{pulse?.whyNow}</p>
            {pulse && (
              <Link href={`/destinations/${pulse.slug}`} className="btn btn-ghost btn-sm mt-4 min-h-11 self-start">
                Open destination →
              </Link>
            )}
          </Panel>
          <Panel title="Must do shortlist">
            {mustDos.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Vote on the inspiration board to grow a shortlist.</p>
            ) : (
              mustDos.map((item) => (
                <p key={item.id} className="py-1 text-[13px] text-ink">
                  {item.title}
                </p>
              ))
            )}
          </Panel>
        </div>
      )}

      {tab === 'inspiration' && (
        <div className="mt-8 grid gap-4">
          <p role="note" className="notice">{INSPIRATION_FIXTURE_DISCLOSURE}</p>
          <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
            {board.map((item) => (
              <article key={item.id} className="surface mb-4 break-inside-avoid p-5">
                <p className="eyebrow">{INSPIRATION_KIND_LABEL[item.kind]}</p>
                <h3 className="mt-2 font-display text-2xl text-ink">{item.title}</h3>
                {item.subtitle && <p className="mt-1 text-[13px] text-ink-muted">{item.subtitle}</p>}
                {item.note && <p className="mt-2 text-[13px] text-ink-muted">{item.note}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  {(['mustDo', 'maybe', 'skip'] as InspirationVote[]).map((vote) => (
                    <Button
                      key={vote}
                      size="sm"
                      variant={votes[item.id] === vote ? 'brass' : 'ghost'}
                      selected={votes[item.id] === vote}
                      onClick={() => {
                        setVotes((current) => ({ ...current, [item.id]: vote }));
                        track('inspiration_voted', { id: item.id, vote });
                      }}
                    >
                      {vote === 'mustDo' ? 'Must do' : vote === 'maybe' ? 'Maybe' : 'Skip'}
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'plan' && (
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {['Arrive', 'The week', 'Depart'].map((bucket) => (
            <Panel key={bucket} title={bucket}>
              <p className="text-[13px] text-ink-muted">
                Day buckets only. This is not a professional itinerary builder.
              </p>
              {bucket === 'The week' && mustDos[0] && (
                <p className="mt-3 text-[13px] text-ink">{mustDos[0].title}</p>
              )}
            </Panel>
          ))}
        </div>
      )}

      {tab === 'people' && (
        <div className="mt-8 grid gap-3">
          <p role="note" className="notice">Editorial portraits standing in for a roster. Not live members.</p>
          {members.map((portrait) =>
            portrait ? (
              <Link
                key={portrait.person.handle}
                href={`/people/${portrait.person.handle}`}
                className="surface transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-surface-3 hover:shadow-[var(--shadow-soft-2)] active:translate-y-px active:shadow-[var(--shadow-inset)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none flex items-center gap-3 p-4"
              >
                <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={44} />
                <div>
                  <p className="text-[14px] text-ink">{portrait.person.displayName}</p>
                  <p className="text-[12px] text-ink-muted">{portrait.featuredModes.join(' · ')}</p>
                </div>
              </Link>
            ) : null,
          )}
        </div>
      )}

      {tab === 'access' && (
        <div className="mt-8 grid gap-4">
          <p role="note" className="notice">{ACCESS_FIXTURE_DISCLOSURE}</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {offers.map((offer) => (
              <OpportunityCardView key={offer.id} offer={offer} />
            ))}
          </div>
        </div>
      )}

      {tab === 'chat' && (
        <Panel className="mt-8" title="Conversation">
          <p className="text-[13px] text-ink-muted">
            Live Circle chat stays on the signed-in Community surface. This preview does not invent messages.
          </p>
          <Link href="/community" className="btn btn-ghost btn-sm mt-4 min-h-11">
            Open Community chat →
          </Link>
        </Panel>
      )}
    </main>
  );
}
