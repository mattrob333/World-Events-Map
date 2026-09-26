'use client';

import { useCallback, useEffect, useState } from 'react';
import { FEATURES } from '@/lib/flags';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import { useLiveCalendar, useLiveCalendarSync } from '@/lib/data/live-store';
import { EventSaveButton } from './EventSaveButton';
import styles from './community.module.css';

export function SavedEvents({ initialEvent = '' }: { initialEvent?: string }) {
  useLiveCalendarSync();
  const calendar = useLiveCalendar((s) => s.events);
  const EVENT_INDEX = new Map(calendar.map((event) => [event.id, event]));
  const { client, user } = usePlatformAuth();
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!client || !user) return;
    const result = await client
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setEvents((result.data ?? []).map((row) => row.event_id));
  }, [client, user]);
  useEffect(() => {
    void refresh();
    window.addEventListener('meridian:saved-events-changed', refresh);
    return () =>
      window.removeEventListener('meridian:saved-events-changed', refresh);
  }, [refresh]);
  if (!user) return null;
  return (
    <section className={styles.card}>
      <h2>Your next possibilities</h2>
      <p className={styles.muted}>Saved to your account, ready when you are.</p>
      {initialEvent && !events.includes(initialEvent) && (
        <div className={styles.notice}>
          <strong>
            {EVENT_INDEX.get(initialEvent)?.name ?? 'Your selected event'}
          </strong>
          <p>Keep this event on your shortlist.</p>
          <EventSaveButton eventId={initialEvent} />
        </div>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {events.length === 0 ? (
        <p className={styles.small}>
          No saved events yet. Save something that catches your eye on the
          globe.
        </p>
      ) : (
        <div className={styles.list}>
          {events.map((id) => {
            const event = EVENT_INDEX.get(id);
            return (
              <article className={styles.item} key={id}>
                <h3>{event?.name ?? 'Saved event'}</h3>
                {event && (
                  <p className={styles.small}>
                    {event.city}, {event.country} · {event.start}
                  </p>
                )}
                <div className={styles.row}>
                  <a
                    href={`/?event=${encodeURIComponent(id)}`}
                    className={`${styles.button} ${styles.secondary}`}
                  >
                    Explore event
                  </a>
                  {FEATURES.circles ? (
                    <a
                      href={`/community?event=${encodeURIComponent(id)}`}
                      className={`${styles.button} ${styles.secondary}`}
                    >
                      Find a circle
                    </a>
                  ) : null}
                  <EventSaveButton eventId={id} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
