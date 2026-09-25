'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useDesignerStore } from '@/lib/designer/store';
import { completeSpotifyConnect } from '@/lib/designer/spotify';
import styles from './designer.module.css';

export function SpotifyCallback({ code, state, error }: { code?: string; state?: string; error?: string }) {
  const router = useRouter();
  const setDraftListening = useDesignerStore((s) => s.setDraftListening);
  const [failure, setFailure] = useState(
    error === 'access_denied' ? 'Spotify access was not granted, so nothing was imported.' : error ? 'Spotify sign-in did not finish.' : !code || !state ? 'This page only works when Spotify sends you back here.' : '',
  );
  const started = useRef(false);

  useEffect(() => {
    // The authorization code is single-use; guard against a double effect run.
    if (started.current || !code || !state || error) return;
    started.current = true;
    completeSpotifyConnect(code, state)
      .then((listening) => {
        setDraftListening(listening);
        router.replace('/vibe?spotify=connected');
      })
      .catch((cause: unknown) => setFailure(cause instanceof Error ? cause.message : 'Spotify import failed.'));
  }, [code, state, error, router, setDraftListening]);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Spotify</p>
        {failure ? (
          <>
            <h1 className={styles.headline}>Spotify didn’t connect.</h1>
            <p className={styles.lede}>{failure}</p>
            <Link href="/vibe" className={`${styles.ghost} mt-6`}>
              Back to your Vibe profile
            </Link>
          </>
        ) : (
          <h1 className={styles.headline}>Reading your listening…</h1>
        )}
      </div>
    </main>
  );
}
