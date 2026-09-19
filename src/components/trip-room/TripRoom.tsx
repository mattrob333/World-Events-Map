'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button, EmptyState, Panel, cn, formatDateRange } from '@/components/ui';
import { FixtureBanner, OpportunityCardView } from '@/components/shell';
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
import { EVENTS } from '@/lib/data/events';
import { todayISO } from '@/lib/buzz/dates';
import { Avatar } from '@/components/social';
import { track } from '@/lib/analytics';

const TABS = ['overview', 'inspiration', 'plan', 'people', 'access', 'chat'] as const;
type Tab = (typeof TABS)[number];

export function CirclesIndex({ destination }: { destination?: string }) {
  const slug = destination?.trim().toLowerCase() ?? '';
  const pulse = slug ? getDestinationBySlug(EVENTS, slug, todayISO()) : undefined;
  const matching = slug ? listTripRoomsForSlug(slug) : [];
  const rest = slug
    ? TRIP_ROOM_FIXTURES.filter((trip) => trip.destinationSlug !== slug)
    : TRIP_ROOM_FIXTURES;
  const placeName = pulse?.name ?? slug;

  return (
    <main className="px-4 py-10 sm:px-8">
      <p className="label-sm text-brass">Circles</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Trip rooms</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-muted">
        A Circle is a trip, not a chat thread. Live Circles still live in Community for members who are signed in.
      </p>
      <FixtureBanner>{TRIP_ROOM_DISCLOSURE}</FixtureBanner>
      {slug ? (
        <section className="mt-8 border border-brass/25 bg-brass-wash px-4 py-4">
          <p className="label-sm text-brass">Starting from {placeName}</p>
          {matching.length === 0 ? (
            <p className="mt-2 max-w-xl text-[13px] text-ink-muted">
              No sample trip room for this destination yet. Live Circles still live in Community
              for members — this preview does not invent a new Circle.
            </p>
          ) : (
            <p className="mt-2 max-w-xl text-[13px] text-ink-muted">
              Sample rooms already on this destination. Opening one does not create a live Circle.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-[13px]">
            {pulse ? (
              <Link href={`/destinations/${pulse.slug}`} className="text-brass">
                Back to {pulse.name}
              </Link>
            ) : null}
            <Link href="/community" className="text-brass">
              Open live Circles
            </Link>
          </div>
        </section>
      ) : null}
      {matching.length > 0 ? (
        <div className="mt-8 grid gap-3 lg:grid-cols-2">
          {matching.map((trip) => (
            <TripRoomCard key={trip.id} trip={trip} highlight />
          ))}
        </div>
      ) : null}
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {rest.map((trip) => (
          <TripRoomCard key={trip.id} trip={trip} />
        ))}
      </div>
      <p className="mt-8 text-[13px] text-ink-muted">
        Already a member?{' '}
        <Link href="/community" className="text-brass">
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
      className={cn('glass rounded-[3px] p-5', highlight && 'border border-brass/40')}
    >
      <p className="label-sm text-brass">{trip.destinationLabel}</p>
      <h2 className="mt-2 font-display text-3xl text-ink">{trip.name}</h2>
      <p className="mt-2 text-[12px] text-ink-muted">
        {formatDateRange(trip.start, trip.end)} · {trip.travelMode}
      </p>
      <p className="mt-4 text-[13px] text-ink-muted">{trip.nextDecision}</p>
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
            <Link href="/circles" className="text-brass">
              All trip rooms
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
      <FixtureBanner>{TRIP_ROOM_DISCLOSURE}</FixtureBanner>
      <header className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="label-sm text-brass">
            {trip.destinationLabel} · {trip.travelMode}
          </p>
          <h1 className="mt-2 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95] text-ink">
            {trip.name}
          </h1>
          <p className="mt-3 text-[13px] text-ink-muted">
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

      <div className="mt-8 flex gap-1 overflow-x-auto" role="tablist" aria-label="Trip room sections">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={`label min-h-11 shrink-0 rounded-[2px] px-3 py-3 ${tab === item ? 'bg-brass-wash text-brass' : 'text-ink-muted'}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Panel title="Countdown" accent>
            <p className="font-display text-4xl text-ink">{formatDateRange(trip.start, trip.end)}</p>
            <p className="mt-3 text-[13px] text-ink-muted">{trip.nextDecision}</p>
          </Panel>
          <Panel title="Destination pulse">
            <p className="font-display text-4xl">{pulse?.score ?? '—'}</p>
            <p className="mt-2 text-[13px] text-ink-muted">{pulse?.whyNow}</p>
            {pulse && (
              <Link href={`/destinations/${pulse.slug}`} className="mt-3 inline-block text-[12px] text-brass">
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
          <FixtureBanner>{INSPIRATION_FIXTURE_DISCLOSURE}</FixtureBanner>
          <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
            {board.map((item) => (
              <article key={item.id} className="glass mb-3 break-inside-avoid p-4">
                <p className="label-sm text-brass">{INSPIRATION_KIND_LABEL[item.kind]}</p>
                <h3 className="mt-2 font-display text-2xl text-ink">{item.title}</h3>
                {item.subtitle && <p className="mt-1 text-[12px] text-ink-muted">{item.subtitle}</p>}
                {item.note && <p className="mt-2 text-[12px] text-ink-muted">{item.note}</p>}
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
          <FixtureBanner>Editorial portraits standing in for a roster. Not live members.</FixtureBanner>
          {members.map((portrait) =>
            portrait ? (
              <Link
                key={portrait.person.handle}
                href={`/people/${portrait.person.handle}`}
                className="glass flex items-center gap-3 p-4"
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
          <FixtureBanner>{ACCESS_FIXTURE_DISCLOSURE}</FixtureBanner>
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
          <Link href="/community" className="mt-4 inline-block text-[12px] text-brass">
            Open Community chat →
          </Link>
        </Panel>
      )}
    </main>
  );
}
