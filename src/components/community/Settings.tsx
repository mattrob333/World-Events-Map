'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { PlatformShell, SignInCard } from '@/components/community/PlatformShell';
import styles from '@/components/community/community.module.css';
import { useHydrated } from '@/components/designer/useHydrated';
import { clearDeviceData } from '@/lib/designer/deviceData';
import { useDesignerStore } from '@/lib/designer/store';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

/**
 * Settings, the usual way: account, profile basics, privacy, and what is
 * stored on this device. The member introduction and travel modes (who
 * Circles match you with) are a separate page, linked from here.
 */
export function Settings() {
  const { user } = usePlatformAuth();
  return (
    <PlatformShell eyebrow="Settings" title="Settings" description="Your account, the basics we plan from, privacy, and the data on this device.">
      <div className={styles.stack}>
        <section className={styles.card} aria-labelledby="settings-account">
          <h2 id="settings-account">Account</h2>
          <SignInCard />
        </section>
        {user ? <ProfileBasics key={user.id} /> : null}
        <section className={styles.card} aria-labelledby="settings-profiles">
          <h2 id="settings-profiles">Traveler profile</h2>
          <p className={styles.muted}>What you told us about you, your crew and your taste. It shapes every trip idea.</p>
          <div className={styles.row}>
            <Link href="/vibe" className={styles.button}>Open traveler profile</Link>
            {user ? <Link href="/account" className={`${styles.button} ${styles.secondary}`}>Member introduction and travel modes</Link> : null}
          </div>
        </section>
        <DeviceData />
      </div>
    </PlatformShell>
  );
}

function ProfileBasics() {
  const { client, user } = usePlatformAuth();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void client
      .from('profiles')
      .select('display_name,home_city,home_airport,is_public')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) {
          setError('Your settings couldn’t load just now. Refresh to try again.');
          return;
        }
        setName(data?.display_name ?? '');
        setCity(data?.home_city ?? '');
        setHomeAirport(data?.home_airport ?? '');
        setVisible(data?.is_public === true);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [client, user]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!client || !user) return;
    setBusy(true);
    setNotice('');
    setError('');
    // Only these columns: interests and the introduction keep what the member page saved.
    const { error: failure } = await client.from('profiles').upsert({
      id: user.id,
      display_name: name.trim(),
      home_city: city.trim(),
      home_airport: homeAirport.trim().toUpperCase(),
      is_public: visible,
    });
    setBusy(false);
    if (failure) setError('That didn’t save. Check your connection and try again.');
    else setNotice('Settings saved.');
  }

  return (
    <section className={styles.card} aria-labelledby="settings-basics">
      <h2 id="settings-basics">Profile basics</h2>
      <form className={styles.form} onSubmit={save}>
        <label>
          Display name
          <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
        <div className={styles.split}>
          <label>
            Home city
            <input maxLength={120} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Atlanta, Georgia" autoComplete="address-level2" />
          </label>
          <label>
            Home airport
            <input maxLength={4} value={homeAirport} onChange={(e) => setHomeAirport(e.target.value.toUpperCase())} placeholder="ATL" />
          </label>
        </div>
        <h3 className={styles.small}>Privacy</h3>
        <label className={styles.check}>
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Let signed-in members find my introduction
        </label>
        <p className={styles.small}>Your email is never shown to other members.</p>
        <button className={styles.button} disabled={busy || !ready}>{busy ? 'Saving…' : 'Save settings'}</button>
      </form>
      {notice ? <p role="status" className={styles.notice}>{notice}</p> : null}
      {error ? <p role="alert" className={`${styles.notice} ${styles.error}`}>{error}</p> : null}
    </section>
  );
}

function DeviceData() {
  const hydrated = useHydrated();
  const clearAll = useDesignerStore((state) => state.clearAll);
  const profiles = useDesignerStore((state) => state.profiles.length);
  const trips = useDesignerStore((state) => (state.trip ? 1 : 0) + (state.previousTrip ? 1 : 0));
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

  function clear() {
    clearAll();
    clearDeviceData();
    setConfirming(false);
    setDone(true);
  }

  return (
    <section className={styles.card} aria-labelledby="settings-device">
      <h2 id="settings-device">Data on this device</h2>
      <p className={styles.muted}>
        {hydrated ? `${profiles} traveler profile${profiles === 1 ? '' : 's'} and ${trips} trip${trips === 1 ? '' : 's'} are saved in this browser only.` : 'Profiles and trips are saved in this browser only.'}
      </p>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="settings-clear-title" className={styles.stack}>
          <p id="settings-clear-title" className={styles.muted}>
            Delete your trips, votes, traveler profiles and cached research from this browser? Links you already sent keep working for the people who have them.
          </p>
          <div className={styles.row}>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={clear}>Delete everything</button>
            <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={() => setConfirming(true)}>Clear data on this device</button>
      )}
      {done ? <p role="status" className={styles.notice}>This device is clear.</p> : null}
    </section>
  );
}
