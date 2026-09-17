'use client';

import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './community.module.css';

export function PlatformShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Main navigation">
        <Link href="/" className={styles.brand}>
          MERIDIAN
        </Link>
        <div className={styles.links}>
          <Link href="/">Pulse</Link>
          <Link href="/constellation">Constellation</Link>
          <Link href="/community">Travel circles</Link>
          <Link href="/account">Your profile</Link>
          <Link href="/partners">For partners</Link>
        </div>
      </nav>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      {children}
    </main>
  );
}

export function SignInCard() {
  const { client, user, loading, error, signIn, signOut } = usePlatformAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setFailure('');
    try {
      await signIn(email.trim());
      setNotice(
        'Check your email for a secure sign-in link. You can close this page and return using that link.',
      );
    } catch (cause) {
      setFailure(
        cause instanceof Error
          ? cause.message
          : 'Sign-in could not be started. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!client)
    return (
      <section className={styles.notice}>
        <strong>Membership is not connected yet.</strong>
        <p>
          Profiles, travel modes, circles and partner requests need the membership
          service. Pulse still works while the service is being connected. No
          account or request will be created here until it is available.
        </p>
      </section>
    );
  if (loading) return <p className={styles.muted}>Checking your session…</p>;
  if (user)
    return (
      <div className={styles.row}>
        <span className={styles.small}>Signed in as {user.email}</span>
        <button
          className={`${styles.button} ${styles.secondary}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
            } catch (cause) {
              setFailure(
                cause instanceof Error ? cause.message : 'Could not sign out.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign out
        </button>
        {failure && <p role="alert">{failure}</p>}
      </div>
    );
  return (
    <section className={styles.card}>
      <h2>Your next good connection.</h2>
      <p className={styles.muted}>
        Sign in to introduce yourself, use Constellation, request a place in a travel circle,
        or ask a partner about an offer.
      </p>
      <form onSubmit={submit} className={styles.form}>
        <label>
          Email address
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button className={styles.button} disabled={busy}>
          {busy ? 'Sending your link…' : 'Email me a sign-in link'}
        </button>
      </form>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {(failure || error) && (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          {failure || error}
        </p>
      )}
    </section>
  );
}
