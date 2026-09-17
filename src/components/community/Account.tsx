'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  PlatformShell,
  SignInCard,
} from '@/components/community/PlatformShell';
import styles from '@/components/community/community.module.css';
import { SavedEvents } from './SavedEvents';

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
      .select('display_name,home_city,interests,bio,is_public')
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
      description="Tell us what draws you out into the world. Choose how much of your profile other members can see."
    >
      <div className={styles.grid}>
        <div className={styles.stack}>
          <SignInCard />
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
                <label>
                  Home city
                  <input
                    maxLength={120}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="London, United Kingdom"
                  />
                </label>
                <label>
                  Your interests
                  <input
                    maxLength={400}
                    value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    placeholder="Art, sailing, food, live music"
                  />
                  <span className={styles.small}>
                    Separate interests with commas. Up to 12.
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
                  Share my introduction with signed-in members
                </label>
                <p className={styles.small}>
                  Your email is not part of your member profile. Circle hosts
                  can see your introduction when you request to join their
                  circle.
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
          <SavedEvents initialEvent={initialEvent} />
        </div>
        <aside className={styles.card}>
          <span className={styles.eyebrow}>
            A good introduction goes a long way
          </span>
          <h2>Shared interests. New horizons.</h2>
          <p className={styles.muted}>
            Your home city helps circle hosts understand where you are
            travelling from. Your interests help you make a better introduction.
          </p>
          <p className={styles.muted}>
            Profiles are private by default. Joining a circle is a social plan,
            not a travel booking or a payment commitment.
          </p>
          <a href="/community" className={styles.button}>
            Explore travel circles
          </a>
        </aside>
      </div>
    </PlatformShell>
  );
}
