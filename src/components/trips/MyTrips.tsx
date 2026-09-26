'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHydrated } from '@/components/designer/useHydrated';
import { formatDateRange } from '@/components/ui/tokens';
import { resolveDestination, type Itinerary } from '@/lib/designer/itinerary';
import { useDesignerStore } from '@/lib/designer/store';
import { tripMoment } from '@/lib/designer/tripNow';
import { useIntentStore } from '@/lib/intent';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './trips.module.css';
import { YourTrail } from './TripsPage';

export type TripListRow = { id: string; title: string; dates: string; status: string; current: boolean };

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  date.setUTCDate(date.getUTCDate() + Math.max(0, days));
  return date.toISOString().slice(0, 10);
}

/** One row for a trip on this device. Pure, so the list and its tests agree. */
export function tripListRow(trip: Itinerary, current: boolean, now: Date): TripListRow {
  const name = trip.place?.name ?? resolveDestination(trip)?.name ?? 'Untitled trip';
  const start = trip.startDate?.slice(0, 10) ?? '';
  const dates = start ? formatDateRange(start, addDays(start, trip.nights)) : 'No dates yet';
  const moment = trip.days?.length && start ? tripMoment(trip, now) : null;
  const status = !trip.days?.length
    ? 'In progress'
    : moment?.phase === 'after'
      ? 'Past trip'
      : moment?.phase === 'before'
        ? (moment.daysUntil === 0 ? 'Starts today' : moment.daysUntil === 1 ? 'Starts tomorrow' : `In ${moment.daysUntil} days`)
        : 'Happening now';
  return { id: trip.id, title: `${name}${trip.nights ? ` · ${trip.nights} night${trip.nights === 1 ? '' : 's'}` : ''}`, dates, status, current };
}

/**
 * "Your trips": the trips this traveler started, finished or not, and one
 * way to start another. The marketing and planner page is /trips/new.
 */
export function MyTrips() {
  const hydrated = useHydrated();
  const router = useRouter();
  const trip = useDesignerStore((state) => state.trip);
  const previousTrip = useDesignerStore((state) => state.previousTrip);
  const restorePreviousTrip = useDesignerStore((state) => state.restorePreviousTrip);
  const storedItems = useIntentStore((state) => state.items);
  const { user } = usePlatformAuth();
  const now = new Date();

  const rows: TripListRow[] = hydrated
    ? [
        ...(trip ? [tripListRow(trip, true, now)] : []),
        ...(previousTrip && previousTrip.trip.id !== trip?.id ? [tripListRow(previousTrip.trip, false, now)] : []),
      ]
    : [];
  const items = hydrated ? storedItems : [];
  const saved = items.filter((item) => item.verb === 'save');
  const returnList = [...items.filter((item) => item.verb === 'watch'), ...items.filter((item) => item.verb === 'idGo')];

  function open(row: TripListRow) {
    if (!row.current) restorePreviousTrip();
    router.push('/trips/designer');
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <section aria-labelledby="my-trips-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>dope.travel / Trips</p>
              <h2 id="my-trips-title">Your trips</h2>
            </div>
            <Link href="/trips/new" className={styles.primaryAction}>+ Create new trip</Link>
          </div>

          {!hydrated ? null : rows.length ? (
            <ul className={styles.myTripList}>
              {rows.map((row) => (
                <li key={row.id}>
                  <button type="button" className={styles.myTripRow} onClick={() => open(row)}>
                    <span className={styles.intentText}>
                      <span>{row.title}</span>
                      <span className={styles.intentDetail}>{row.dates} · {row.status}{row.current ? '' : ' · Set aside'}</span>
                    </span>
                    <span className={styles.intentVerb}>Open <span aria-hidden="true">↗</span></span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.emptyTrail}>
              <p>You have not started a trip yet. Create one and it shows here, finished or not.</p>
              <Link href="/trips/new">Create new trip <span aria-hidden="true">↗</span></Link>
            </div>
          )}
          <p className={styles.heroNote}>
            Trips you design are saved on this device.
            {user ? <> Trips you share with other people are in <Link href="/circles" className="underline">Circles</Link>.</> : null}
          </p>
        </section>

        <YourTrail saved={saved} returnList={returnList} lead={false} />
      </div>
    </main>
  );
}
