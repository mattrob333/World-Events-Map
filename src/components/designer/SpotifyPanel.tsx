'use client';

import { useState } from 'react';
import { listeningInsights, type ListeningProfile } from '@/lib/designer/listening';
import { spotifyClientId, startSpotifyConnect } from '@/lib/designer/spotify';
import styles from './designer.module.css';

export function SpotifyPanel({ listening, onDisconnect }: { listening: ListeningProfile | null; onDisconnect: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = Boolean(spotifyClientId());

  async function connect() {
    setError('');
    setBusy(true);
    try {
      await startSpotifyConnect();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start Spotify sign-in.');
      setBusy(false);
    }
  }

  if (listening) {
    const insights = listeningInsights(listening);
    return (
      <section className={styles.spotify} aria-labelledby="spotify-title">
        <div className={styles.row}>
          <span className={styles.spotifyMark} aria-hidden>
            ●
          </span>
          <h2 id="spotify-title" className="text-[15px] font-semibold text-ink">
            Spotify connected
          </h2>
          <span className={styles.badge}>Imported {new Date(listening.importedAt).toLocaleDateString()}</span>
          <button type="button" className={`${styles.miniBtn} ml-auto`} onClick={onDisconnect}>
            Remove Spotify data
          </button>
        </div>
        <p className="mt-2 text-[13px] text-ink-muted">
          Top artists: {listening.topArtists.slice(0, 5).join(', ') || 'none returned'}
          {listening.genres.length ? ` · Genres: ${listening.genres.slice(0, 5).join(', ')}` : ''}
        </p>
        {insights.length ? (
          <ul className={styles.insights}>
            {insights.map((insight) => (
              <li key={insight.id} className={styles.insight}>
                <span aria-hidden className="text-[20px]">
                  {insight.emoji}
                </span>
                <span>
                  <strong className="block text-[13.5px] text-ink">{insight.title}</strong>
                  <span className="text-[12px] text-ink-muted">{insight.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className={styles.hint}>
          Read once, with read-only access, and summarized on this device. MERIDIAN never stores your Spotify login, and only this summary is saved, on this device only.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.spotify} aria-labelledby="spotify-title">
      <div className={styles.row}>
        <span className={styles.spotifyMark} aria-hidden>
          ●
        </span>
        <h2 id="spotify-title" className="text-[15px] font-semibold text-ink">
          Add your Spotify
        </h2>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-ink-muted">
        Your top artists, genres, the decades you love, and when you listen say a lot about your trip vibe. We use them to pace late
        nights, find shows by your artists, and spot tribute and cover bands.
      </p>
      <div className={`${styles.row} mt-3`}>
        <button type="button" className={styles.spotifyBtn} onClick={connect} disabled={!configured || busy}>
          {busy ? 'Opening Spotify…' : 'Connect Spotify'}
        </button>
        {!configured ? <span className={styles.hint}>Spotify isn’t set up for this app yet.</span> : null}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.hint}>
        Read-only: top artists and tracks, recently played, and playlist names. While the app is in Spotify’s development mode, only accounts the
        owner has added can connect.
      </p>
    </section>
  );
}
