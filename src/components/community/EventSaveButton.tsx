'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useIntentStore } from '@/lib/intent';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './community.module.css';

/**
 * Without a member account, saving uses the same device-local store as the
 * destination page and Trips, so an event saved anywhere shows as saved here
 * too (red team UFR-A03). Account saving takes over once the traveler signs in.
 */
function DeviceSave({ eventId, label, signInHref }: { eventId: string; label: string; signInHref?: string }) {
  const items = useIntentStore((state) => state.items);
  const toggle = useIntentStore((state) => state.toggle);
  const saved = items.some((item) => item.verb === 'save' && item.kind === 'event' && item.id === eventId);
  return (
    <div>
      <button
        type="button"
        aria-pressed={saved}
        className={`${styles.button} ${styles.secondary} ${saved ? styles.active : ''}`}
        onClick={() => toggle({ verb: 'save', kind: 'event', id: eventId, label, href: `/?event=${encodeURIComponent(eventId)}` })}
      >
        {saved ? 'Saved on this device ✓' : 'Save on this device'}
      </button>
      <p className={styles.small}>
        {saved ? <><Link href="/trips">Find it in Trips ↗</Link>. </> : null}
        Saved on this device only.{signInHref ? <> <a href={signInHref}>Sign in</a> to keep saves on your account.</> : null}
      </p>
    </div>
  );
}

export function EventSaveButton({ eventId, label = 'Saved event' }: { eventId: string; label?: string }) {
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
  if (!client) return <DeviceSave eventId={eventId} label={label} />;
  if (loading)
    return (
      <button className={`${styles.button} ${styles.secondary}`} disabled>
        Checking your saved events…
      </button>
    );
  if (!user)
    return (
      <DeviceSave
        eventId={eventId}
        label={label}
        signInHref={`/account?event=${encodeURIComponent(eventId)}`}
      />
    );
  return (
    <div>
      <button
        className={`${styles.button} ${styles.secondary} ${saved && readyFor === identity ? styles.active : ''}`}
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
