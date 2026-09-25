'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './login.module.css';

type Step = 'start' | 'email' | 'sent';

/** Only same-site paths: "/trips", never "//evil.example" or back to /login. */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/login/')) return '/';
  return value.slice(0, 300);
}

/**
 * The front door for members: the logo in the middle of a sunset, one button,
 * and an emailed sign-in link. Nobody needs it to look around; it's for saving,
 * circles and anything that follows you across devices.
 */
export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const { client, user, loading, signIn, signOut } = usePlatformAuth();
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const cameBack = useRef(false);

  // Back from the emailed link with somewhere to go: go there.
  useEffect(() => {
    if (!user || cameBack.current || !params.get('next')) return;
    cameBack.current = true;
    const timer = window.setTimeout(() => router.replace(next), 900);
    return () => window.clearTimeout(timer);
  }, [user, next, params, router]);

  useEffect(() => {
    if (step === 'email') emailRef.current?.focus();
  }, [step]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setFailure('That email doesn’t look right.');
      return;
    }
    setBusy(true);
    setFailure('');
    try {
      await signIn(address);
      setStep('sent');
    } catch (cause) {
      setFailure(cause instanceof Error ? cause.message : 'Couldn’t send the link. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.screen}>
      <div className={styles.sky} aria-hidden="true">
        <span className={styles.glow} />
        <span className={styles.glowTwo} />
        <span className={styles.horizon} />
        <span className={styles.bands} />
      </div>

      <div className={styles.center}>
        <h1 className={styles.logo}>
          {/* The brand lockup: the sun is the "o". */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/dope-travel-lockup.svg" alt="dope.travel" width={752} height={252} />
        </h1>
        <p className={styles.tagline}>Find the moment. Follow the feeling.</p>

        <div className={styles.actions} aria-live="polite">
          {!client ? (
            <>
              <p className={styles.note}>Member sign-in isn’t switched on for this site yet. Everything else works without an account.</p>
              <Link className={styles.cta} href={next}>Look around</Link>
            </>
          ) : loading ? (
            <p className={styles.note}>Checking your session…</p>
          ) : user ? (
            <>
              <p className={styles.note}>You’re in{user.email ? ` as ${user.email}` : ''}.</p>
              <Link className={styles.cta} href={next}>Continue <span aria-hidden="true">→</span></Link>
              <button
                type="button"
                className={styles.quiet}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try { await signOut(); } finally { setBusy(false); }
                }}
              >
                Sign out
              </button>
            </>
          ) : step === 'start' ? (
            <>
              <button type="button" className={styles.cta} onClick={() => setStep('email')}>Log in</button>
              <Link className={styles.quiet} href={next}>Look around first <span aria-hidden="true">→</span></Link>
            </>
          ) : step === 'email' ? (
            <form className={styles.form} onSubmit={submit} noValidate>
              <label className={styles.field}>
                <span className={styles.srOnly}>Email</span>
                <input
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(event) => { setEmail(event.target.value); if (failure) setFailure(''); }}
                  maxLength={254}
                  aria-invalid={Boolean(failure) || undefined}
                />
              </label>
              <button type="submit" className={styles.cta} disabled={busy}>{busy ? 'Sending…' : 'Email me a link'}</button>
              {failure && <p className={styles.error} role="alert">{failure}</p>}
              <button type="button" className={styles.quiet} onClick={() => { setStep('start'); setFailure(''); }}>Back</button>
            </form>
          ) : (
            <>
              <p className={styles.sent}>Check your inbox.</p>
              <p className={styles.note}>We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device and you’re in.</p>
              <button type="button" className={styles.quiet} onClick={() => setStep('email')}>Use a different email</button>
            </>
          )}
        </div>
      </div>

      <p className={styles.footnote}>No password. Your email is only used to sign you in.</p>
    </main>
  );
}
