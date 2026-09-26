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
          {user ? <AccountSync /> : <p className={styles.small}>Sign in to keep your traveler profiles with your account, on every device.</p>}
        </section>
        <section className={styles.card} aria-labelledby="settings-ai">
          <h2 id="settings-ai">Bring your AI</h2>
          <p className={styles.muted}>Connect Claude, ChatGPT or another assistant to your traveler profile and trip tools.</p>
          <div className={styles.row}>
            <Link href="/agents" className={`${styles.button} ${styles.secondary}`}>Set up your AI</Link>
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

/**
 * Keep traveler profiles in the account: opt-in, per device. On uploads this
 * device's profiles (or, when they belong to another account, replaces them
 * with this account's). Off stops saving first, then deletes the account copy.
 */
function AccountSync() {
  const { client, user } = usePlatformAuth();
  const hydrated = useHydrated();
  const on = useDesignerStore((state) => state.accountSync);
  const owner = useDesignerStore((state) => state.syncOwner);
  const names = useDesignerStore((state) => state.profiles.map((entry) => entry.label ?? entry.profile.name ?? 'Unnamed').slice(0, 4));
  const count = useDesignerStore((state) => state.profiles.length);
  const status = useDesignerStore((state) => state.syncStatus);
  const setAccountSync = useDesignerStore((state) => state.setAccountSync);
  const applySyncedProfiles = useDesignerStore((state) => state.applySyncedProfiles);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!hydrated || !user) return null;
  const foreign = Boolean(owner && owner !== user.id);
  const active = on && owner === user.id;

  async function turnOn() {
    if (!user) return;
    if (foreign) {
      // These belong to someone else's account: they're never uploaded here.
      applySyncedProfiles([]);
    }
    setAccountSync(true, user.id);
    setMessage(foreign ? 'This device now shows your account’s traveler profiles.' : 'Your traveler profiles are saving to your account.');
  }

  async function turnOff() {
    if (!client || !user) return;
    setMessage('');
    setBusy(true);
    // Stop saving first, so nothing in flight re-creates what's being deleted.
    setAccountSync(false);
    const { error } = await client.from('traveler_profiles').delete().eq('user_id', user.id);
    setBusy(false);
    if (error) {
      setAccountSync(true, user.id);
      setMessage('That didn’t go through, so account saving is still on. Check your connection and try again.');
      return;
    }
    setMessage('Removed from your account. They stay on this device.');
  }

  return (
    <div className={styles.stack}>
      <label className={styles.check}>
        <input type="checkbox" checked={active} disabled={busy} onChange={(event) => void (event.target.checked ? turnOn() : turnOff())} />
        Keep my traveler profiles in my account
      </label>
      <p className={styles.small}>
        {foreign
          ? 'The traveler profiles on this device were saved by a different account. Turning this on removes them from this device and shows yours instead; theirs are never added to your account.'
          : active
            ? 'On: your profiles (including names and ages you mention, tastes, music summary and travel style) are saved to your account so they follow you to any device. Only you can see them. Off removes them from your account; this device keeps its copy.'
            : `Off: your profiles live on this device only. Turn this on to save ${count ? `the ${count} on this device (${names.join(', ')}${count > names.length ? '…' : ''})` : 'them'} to your account, where only you can see them, so they follow you to any device.`}
      </p>
      {active && status === 'error' ? <p role="alert" className={`${styles.notice} ${styles.error}`}>Couldn’t save to your account just now. It will try again when you’re back online.</p> : null}
      {message ? <p role="status" className={styles.notice}>{message}</p> : null}
    </div>
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
        {hydrated ? `${profiles} traveler profile${profiles === 1 ? '' : 's'} and ${trips} trip${trips === 1 ? '' : 's'} are saved in this browser.` : 'Profiles and trips are saved in this browser.'}
        {' '}Clearing them here doesn’t touch a copy in your account; it turns account saving off on this device.
      </p>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="settings-clear-title" className={styles.stack}>
          <p id="settings-clear-title" className={styles.muted}>
            Delete your trips, votes, traveler profiles and cached research from this browser? Your account’s copy (if you keep one) stays; turn it off above to remove it. Links you already sent keep working for the people who have them.
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
