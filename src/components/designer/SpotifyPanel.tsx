'use client';

import { useState } from 'react';
import { listeningInsights, parsePlaylistRef, type ListeningProfile } from '@/lib/designer/listening';
import { spotifyClientId, startSpotifyConnect } from '@/lib/designer/spotify';
import styles from './designer.module.css';

type ReadResult = { listening?: ListeningProfile; error?: string; code?: string };

export function SpotifyPanel({
  listening,
  onDisconnect,
  onImported,
}: {
  listening: ListeningProfile | null;
  onDisconnect: () => void;
  onImported: (listening: ListeningProfile) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playlist, setPlaylist] = useState('');
  const configured = Boolean(spotifyClientId());
  const playlistOk = !playlist.trim() || parsePlaylistRef(playlist) !== null;

  /** Public playlists are read by the app without a sign-in; anything else goes through Spotify sign-in. */
  async function readLink() {
    const ref = parsePlaylistRef(playlist);
    if (!ref) return;
    setError('');
    if (ref.kind === 'liked') return connect();
    setBusy(true);
    try {
      const response = await fetch('/api/designer/playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ link: playlist }),
      });
      const body = (await response.json()) as ReadResult;
      if (response.ok && body.listening) {
        onImported(body.listening);
        setPlaylist('');
        setBusy(false);
        return;
      }
      if (body.code === 'NOT_CONFIGURED') {
        if (configured) return connect();
        throw new Error('Spotify isn’t hooked up on this app yet. For now, name your favorite artists and genres in your ramble above.');
      }
      throw new Error(body.error ?? 'Spotify didn’t respond. Try again in a minute.');
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== 'Failed to fetch' ? cause.message : 'You look offline. Try again when you’re connected.');
      setBusy(false);
    }
  }

  async function connect() {
    setError('');
    setBusy(true);
    try {
      await startSpotifyConnect(playlist);
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
            Your music, from Spotify
          </h2>
          <span className={styles.badge}>Imported {new Date(listening.importedAt).toLocaleDateString()}</span>
          <button type="button" className={`${styles.miniBtn} ml-auto`} onClick={onDisconnect}>
            Remove Spotify data
          </button>
        </div>
        <p className="mt-2 text-[13px] text-ink-muted">
          {listening.fromPlaylist ? `From “${listening.fromPlaylist}” · ` : ''}
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
        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px] text-ink-muted">Re-read from a specific playlist</summary>
          <label className={`${styles.label} mt-3`}>
            Playlist link
            <input
              className={styles.input}
              value={playlist}
              inputMode="url"
              autoComplete="off"
              placeholder="https://open.spotify.com/playlist/… or “liked”"
              onChange={(e) => setPlaylist(e.target.value)}
              aria-invalid={!playlistOk}
            />
          </label>
          {!playlistOk ? <p className={styles.hint}>Paste a link from Share → Copy link to playlist, or type “liked” for your Liked Songs.</p> : null}
          <button type="button" className={`${styles.miniBtn} mt-2`} onClick={readLink} disabled={busy || !playlistOk || !playlist.trim()}>
            {busy ? 'Opening Spotify…' : 'Read this playlist'}
          </button>
        </details>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.hint}>
          Read once, with read-only access, and summarized on this device. dope.travel never stores your Spotify login, and only this summary is saved, on this device only.
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
      <label className={`${styles.label} mt-3`}>
        Got a favorites playlist? Paste it (optional)
        <input
          className={styles.input}
          value={playlist}
          inputMode="url"
          autoComplete="off"
          placeholder="https://open.spotify.com/playlist/… or “liked”"
          onChange={(e) => setPlaylist(e.target.value)}
          aria-invalid={!playlistOk}
        />
      </label>
      {!playlistOk ? <p className={styles.hint}>Paste a link from Share → Copy link to playlist, or type “liked” for your Liked Songs.</p> : null}
      <div className={`${styles.row} mt-3`}>
        {playlist.trim() ? (
          <button type="button" className={styles.spotifyBtn} onClick={readLink} disabled={busy || !playlistOk}>
            {busy ? 'Reading the playlist…' : 'Read this playlist'}
          </button>
        ) : (
          <button type="button" className={styles.spotifyBtn} onClick={connect} disabled={!configured || busy}>
            {busy ? 'Opening Spotify…' : 'Connect Spotify'}
          </button>
        )}
        {!configured && !playlist.trim() ? <span className={styles.hint}>Sign-in isn’t set up yet; paste a public playlist link instead.</span> : null}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.hint}>
        A public playlist link is read without signing in: we look at its songs and artists, summarize them, and keep only the summary
        on this device. Connect Spotify (read-only) for your top artists, recent plays, and Liked Songs. Spotify’s own editorial and mix
        playlists can’t be read by apps. While the app is in Spotify’s development mode, only accounts the
        owner has added can connect.
      </p>
    </section>
  );
}
