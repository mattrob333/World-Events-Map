'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  PlatformShell,
  SignInCard,
} from '@/components/community/PlatformShell';
import styles from '@/components/community/community.module.css';
import { SavedEvents } from './SavedEvents';
import { TravelModesEditor } from './TravelModesEditor';

export function Account({ initialEvent = '' }: { initialEvent?: string }) {
  const { user } = usePlatformAuth();
  return (
    <AccountContent key={user?.id ?? 'visitor'} initialEvent={initialEvent} />
  );
}

function AccountContent({ initialEvent }: { initialEvent: string }) {
  const { client, user } = usePlatformAuth();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [homeAirport, setHomeAirport] = useState('');
  const [interests, setInterests] = useState('');
  const [bio, setBio] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void client
      .from('profiles')
      .select('display_name,home_city,home_airport,interests,bio,is_public')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error: failure }) => {
        if (!active) return;
        if (failure) {
          setError(failure.message);
          return;
        }
        setName(data?.display_name ?? '');
        setCity(data?.home_city ?? '');
        setHomeAirport(data?.home_airport ?? '');
        setInterests((data?.interests ?? []).join(', '));
        setBio(data?.bio ?? '');
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
    setError('');
    setNotice('');
    const { error: failure } = await client.from('profiles').upsert({
      id: user.id,
      display_name: name.trim(),
      home_city: city.trim(),
      home_airport: homeAirport.trim().toUpperCase(),
      interests: [
        ...new Set(
          interests
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      ].slice(0, 12),
      bio: bio.trim(),
      is_public: visible,
    });
    setBusy(false);
    if (failure) setError(failure.message);
    else setNotice('Your profile is saved.');
  }
  return (
    <PlatformShell
      eyebrow="Your place in the world"
      title="Travel is better with your people."
      description="Tell dope.travel who you are, then create different travel modes for the different ways you move through the world."
    >
      <div className={styles.grid}>
        <div className={styles.stack}>
          <SignInCard />
          <p className={styles.muted}>Your Vibe profiles live on this device, not in an account: <a href="/vibe#saved-title" style={{ display: 'inline-block', minHeight: 44, lineHeight: '44px', textDecoration: 'underline' }}>Open my Vibe profile →</a></p>
          {user && (
            <section className={styles.card}>
              <h2>Your introduction</h2>
              <form className={styles.form} onSubmit={save}>
                <label>
                  Display name
                  <input
                    required
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <div className={styles.split}>
                  <label>
                    Home city
                    <input
                      maxLength={120}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Atlanta, Georgia"
                    />
                  </label>
                  <label>
                    Home airport
                    <input
                      maxLength={4}
                      value={homeAirport}
                      onChange={(e) => setHomeAirport(e.target.value.toUpperCase())}
                      placeholder="KATL"
                    />
                  </label>
                </div>
                <label>
                  Your broad interests
                  <input
                    maxLength={400}
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="Art, skiing, food, Formula 1"
                  />
                  <span className={styles.small}>
                    Keep these broad. Travel modes below capture the context for a specific kind of trip.
                  </span>
                </label>
                <label>
                  A little about you
                  <textarea
                    maxLength={600}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Your kind of weekend, and the people you hope to meet."
                  />
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setVisible(e.target.checked)}
                  />
                  Let signed-in members discover my introduction
                </label>
                <p className={styles.small}>
                  Your email is never part of your member profile. Travel modes have their own visibility control, so a public introduction does not automatically expose trip intent.
                </p>
                <button className={styles.button} disabled={busy || !ready}>
                  {busy ? 'Saving…' : 'Save your profile'}
                </button>
              </form>
              {notice && (
                <p role="status" className={styles.notice}>
                  {notice}
                </p>
              )}
              {error && (
                <p role="alert" className={`${styles.notice} ${styles.error}`}>
                  {error}
                </p>
              )}
            </section>
          )}
          <TravelModesEditor />
          <SavedEvents initialEvent={initialEvent} />
        </div>
        <aside className={styles.card}>
          <span className={styles.eyebrow}>One person. Different trips.</span>
          <h2>Choose the lens before dope.travel chooses the people.</h2>
          <p className={styles.muted}>
            Family ski, solo weekend and work layover should produce completely different circles and recommendations. Travel modes let you switch context without pretending you only have one traveler identity.
          </p>
          <p className={styles.muted}>
            Your home airport also becomes the source for future aviation matching. dope.travel will not show a personalized charter estimate until the actual origin is known.
          </p>
          <div className={styles.row}>
            <a href="/community" className={styles.button}>
              Explore travel circles
            </a>
            <a href="/welcome" className={`${styles.button} ${styles.secondary}`}>
              Edit traveler lens
            </a>
          </div>
        </aside>
      </div>
    </PlatformShell>
  );
}
