'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from '@/components/community/community.module.css';
import profileStyles from './profileEditor.module.css';

type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'declined';
};

type ProfileSummary = {
  id: string;
  handle: string | null;
  display_name: string;
  home_city: string;
  is_public: boolean;
};

function explain(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return 'Connections could not be loaded.';
}

export function ConnectionsPanel() {
  const { client, user } = usePlatformAuth();
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileSummary>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!client || !user) return;
    const { data, error: failure } = await client
      .from('profile_connections')
      .select('id,requester_id,addressee_id,status')
      .order('updated_at', { ascending: false });
    if (failure) throw failure;

    const rows = (data ?? []) as ConnectionRow[];
    setConnections(rows);
    const ids = [
      ...new Set(
        rows.flatMap((row) => [row.requester_id, row.addressee_id]).filter((id) => id !== user.id),
      ),
    ];
    if (!ids.length) {
      setProfiles({});
      return;
    }

    const result = await client
      .from('profiles')
      .select('id,handle,display_name,home_city,is_public')
      .in('id', ids);
    if (result.error) throw result.error;
    setProfiles(
      Object.fromEntries(
        (result.data ?? []).map((profile) => [profile.id, profile as ProfileSummary]),
      ),
    );
  }, [client, user]);

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void (async () => {
      try {
        await refresh();
      } catch (cause) {
        if (active) setError(explain(cause));
      }
    })();
    return () => {
      active = false;
    };
  }, [client, user, refresh]);

  const inbound = useMemo(
    () =>
      connections.filter(
        (row) => row.status === 'pending' && row.addressee_id === user?.id,
      ),
    [connections, user?.id],
  );
  const outbound = useMemo(
    () =>
      connections.filter(
        (row) => row.status === 'pending' && row.requester_id === user?.id,
      ),
    [connections, user?.id],
  );
  const accepted = useMemo(
    () => connections.filter((row) => row.status === 'accepted'),
    [connections],
  );

  if (!user) return null;

  function otherId(row: ConnectionRow) {
    return row.requester_id === user.id ? row.addressee_id : row.requester_id;
  }

  function identity(row: ConnectionRow) {
    const profile = profiles[otherId(row)];
    return {
      name: profile?.display_name || 'Private traveler',
      city: profile?.home_city || '',
      href: profile?.is_public && profile.handle ? `/people/${profile.handle}` : '',
    };
  }

  async function respond(row: ConnectionRow, status: 'accepted' | 'declined') {
    if (!client || row.addressee_id !== user.id) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client
        .from('profile_connections')
        .update({ status })
        .eq('id', row.id)
        .eq('addressee_id', user.id);
      if (failure) throw failure;
      setNotice(status === 'accepted' ? 'Connection accepted.' : 'Connection declined.');
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ConnectionRow) {
    if (!client) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: failure } = await client
        .from('profile_connections')
        .delete()
        .eq('id', row.id);
      if (failure) throw failure;
      setNotice('Connection removed.');
      await refresh();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  const renderIdentity = (row: ConnectionRow) => {
    const person = identity(row);
    const content = (
      <div>
        <strong>{person.name}</strong>
        <span>{person.city || 'MERIDIAN traveler'}</span>
      </div>
    );
    return person.href ? (
      <Link href={person.href} className={profileStyles.connectionIdentity}>
        {content}
      </Link>
    ) : (
      content
    );
  };

  return (
    <section className={styles.card}>
      <div className={profileStyles.headingRow}>
        <div>
          <span className={styles.eyebrow}>Your traveler network</span>
          <h2>Connections</h2>
          <p className={styles.muted}>
            Connections are person-to-person relationships. They do not reveal private Travel Modes or Circle membership.
          </p>
        </div>
        <Link href="/people" className={styles.button}>Find travelers</Link>
      </div>

      {inbound.length > 0 && (
        <div className={profileStyles.connectionSection}>
          <h3>Waiting on you</h3>
          {inbound.map((row) => (
            <div key={row.id} className={profileStyles.connectionRow}>
              {renderIdentity(row)}
              <div className={styles.row}>
                <button className={styles.button} disabled={busy} onClick={() => void respond(row, 'accepted')}>Accept</button>
                <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void respond(row, 'declined')}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {accepted.length > 0 && (
        <div className={profileStyles.connectionSection}>
          <h3>Your network</h3>
          {accepted.map((row) => (
            <div key={row.id} className={profileStyles.connectionRow}>
              {renderIdentity(row)}
              <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void remove(row)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      {outbound.length > 0 && (
        <div className={profileStyles.connectionSection}>
          <h3>Requests sent</h3>
          {outbound.map((row) => (
            <div key={row.id} className={profileStyles.connectionRow}>
              {renderIdentity(row)}
              <button className={`${styles.button} ${styles.secondary}`} disabled={busy} onClick={() => void remove(row)}>Cancel</button>
            </div>
          ))}
        </div>
      )}

      {!inbound.length && !outbound.length && !accepted.length && (
        <p className={styles.muted}>No connections yet. Start with the traveler directory or someone you meet in a Circle.</p>
      )}

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={`${styles.notice} ${styles.error}`}>{error}</p>}
    </section>
  );
}
