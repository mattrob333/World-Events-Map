'use client';

import Link from 'next/link';
import { EmptyState, Panel } from '@/components/ui';
import { INTENT_LABEL, useIntentStore } from '@/lib/intent';
import { TRIP_ROOM_FIXTURES } from '@/lib/trips';

export function TripsPage() {
  const items = useIntentStore((s) => s.items);
  const saved = items.filter((item) => item.verb === 'save');
  const watched = items.filter((item) => item.verb === 'watch');
  const going = items.filter((item) => item.verb === 'idGo');

  return (
    <main className="px-4 py-10 sm:px-8">
      <p className="label-sm text-brass">Trips</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Upcoming, saved, watched</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-muted">
        Intent on this device. Watch does not send notifications yet. I&apos;d go does not match you to anyone yet.
      </p>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Panel title="Upcoming sample rooms">
          {TRIP_ROOM_FIXTURES.map((trip) => (
            <Link key={trip.id} href={`/circles/${trip.id}`} className="block py-2 text-[13px] text-ink">
              {trip.name}
            </Link>
          ))}
        </Panel>
        <Panel title="Saved">
          {saved.length === 0 ? (
            <EmptyState title="Nothing saved yet." body="Save a destination from World or a destination page." />
          ) : (
            saved.map((item) => (
              <Link key={`${item.kind}-${item.id}`} href={item.href} className="block py-2 text-[13px] text-ink">
                {item.label} · {INTENT_LABEL[item.verb]}
              </Link>
            ))
          )}
        </Panel>
        <Panel title="Watch / I'd go">
          {[...watched, ...going].length === 0 ? (
            <EmptyState title="No watchlist yet." body="Watch a place to keep it on this list." />
          ) : (
            [...watched, ...going].map((item) => (
              <Link key={`${item.verb}-${item.kind}-${item.id}`} href={item.href} className="block py-2 text-[13px] text-ink">
                {item.label} · {INTENT_LABEL[item.verb]}
              </Link>
            ))
          )}
        </Panel>
      </div>
    </main>
  );
}
