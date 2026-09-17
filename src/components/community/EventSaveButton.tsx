'use client';

import { useEffect, useState } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './community.module.css';

export function EventSaveButton({ eventId }: { eventId: string }) {
  const { client, user, loading } = usePlatformAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readyFor, setReadyFor] = useState('');
  const [error, setError] = useState('');
  const identity = `${user?.id ?? ''}:${eventId}`;
  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void client
      .from('saved_events')
      .select('event_id')
      .eq('user_id', user.id)
      .eq('event_id', eventId)
      .maybeSingle()
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setError(result.error.message);
          return;
        }
        setSaved(Boolean(result.data));
        setReadyFor(identity);
      });
    return () => {
      active = false;
    };
  }, [client, user, eventId, identity]);
  if (!client)
    return (
      <span className={styles.small}>
        Event saving will be available when membership is connected.
      </span>
    );
  if (loading)
    return (
      <button className={styles.button} disabled>
        Checking your saved events…
      </button>
    );
  if (!user)
    return (
      <a
        className={styles.button}
        href={`/account?event=${encodeURIComponent(eventId)}`}
      >
        Sign in to save this event
      </a>
    );
  return (
    <div>
      <button
        className={`${styles.button} ${saved && readyFor === identity ? styles.secondary : ''}`}
        disabled={busy || readyFor !== identity}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            const result = saved
              ? await client
                  .from('saved_events')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('event_id', eventId)
              : await client
                  .from('saved_events')
                  .upsert(
                    { user_id: user.id, event_id: eventId },
                    { onConflict: 'user_id,event_id' },
                  );
            if (result.error) {
              setError(result.error.message);
              return;
            }
            setSaved(!saved);
            window.dispatchEvent(new Event('meridian:saved-events-changed'));
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : 'Could not save this event. Try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? 'Saving…'
          : saved && readyFor === identity
            ? 'Saved · Remove'
            : 'Save this event'}
      </button>
      {error && (
        <p className={`${styles.small} ${styles.error}`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
