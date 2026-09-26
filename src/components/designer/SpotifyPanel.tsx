'use client';

import { useState } from 'react';
import { listeningInsights, parsePlaylistRef, type ListeningProfile } from '@/lib/designer/listening';
import { startSpotifyConnect } from '@/lib/designer/spotify';
import styles from './designer.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';
import { MusicDna } from './MusicDna';

type ReadResult = { listening?: ListeningProfile; error?: string; code?: string };

/** What the server can do with Spotify, from serverCapabilities(); never guessed on the client. */
export type SpotifyCapabilities = { spotifyPlaylist: boolean; spotifySignIn: boolean };

const NAME_ARTISTS = 'Name the artists you love in your ramble above (for example “Foo Fighters, Pearl Jam, Tom Petty”) and we’ll pick them up.';

export function SpotifyPanel({
  listening,
  onDisconnect,
  onImported,
  capabilities,
}: {
  listening: ListeningProfile | null;
  onDisconnect: () => void;
  onImported: (listening: ListeningProfile) => void;
  capabilities: SpotifyCapabilities;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playlist, setPlaylist] = useState('');
  const configured = capabilities.spotifySignIn;
  const canRead = capabilities.spotifyPlaylist;
  const available = configured || canRead;
  const playlistOk = !playlist.trim() || parsePlaylistRef(playlist) !== null;

  /** Public playlists are read by the app without a sign-in; anything else goes through Spotify sign-in. */
  async function readLink() {
    const ref = parsePlaylistRef(playlist);
    if (!ref) return;
    setError('');
    // Liked Songs, or a server that can't read public links: the playlist is read through the traveler's own sign-in.
    if ((ref.kind === 'liked' || !canRead) && !configured) {
      setError('Liked Songs needs Spotify sign-in, which isn’t set up on this site. Paste a public playlist link instead.');
      return;
    }
    if (ref.kind === 'liked' || !canRead) return connect();
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
        throw new Error(`Spotify isn’t connected on this site yet. ${NAME_ARTISTS}`);
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
          <SourceLogo source="spotify" size={18} />
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
        <MusicDna listening={listening} />
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
        {available ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[12.5px] text-ink-muted">Re-read from a specific playlist</summary>
          <label className={`${styles.label} mt-3`}>
            Playlist link
            <input
              className={styles.input}
              value={playlist}
              inputMode="url"
              autoComplete="off"
              placeholder={configured ? 'https://open.spotify.com/playlist/… or “liked”' : 'https://open.spotify.com/playlist/…'}
              onChange={(e) => setPlaylist(e.target.value)}
              aria-invalid={!playlistOk}
            />
          </label>
          {!playlistOk ? <p className={styles.hint}>Paste a link from Share → Copy link to playlist{configured ? ', or type “liked” for your Liked Songs' : ''}.</p> : null}
          <button type="button" className={`${styles.miniBtn} mt-2`} onClick={readLink} disabled={busy || !playlistOk || !playlist.trim()}>
            {busy ? 'Opening Spotify…' : 'Read this playlist'}
          </button>
        </details>
        ) : null}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.hint}>
          Read once, with read-only access, and summarized on this device. dope.travel never stores your Spotify login, and only this summary is saved: on this device, and with your traveler profile in your account if you turn that on in Settings.
        </p>
      </section>
    );
  }

  if (!available) {
    return (
      <section className={styles.spotify} aria-labelledby="spotify-title">
        <div className={styles.row}>
          <SourceLogo source="spotify" size={18} />
          <h2 id="spotify-title" className="text-[15px] font-semibold text-ink">
            Your music
          </h2>
        </div>
        <p className="mt-2 text-[13px] leading-5 text-ink-muted">
          Spotify isn’t connected on this site yet, so there’s nothing to sign in to or paste. {NAME_ARTISTS} Your artists and genres
          pace late nights, find shows, and spot tribute and cover bands.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.spotify} aria-labelledby="spotify-title">
      <div className={styles.row}>
        <SourceLogo source="spotify" size={18} />
        <h2 id="spotify-title" className="text-[15px] font-semibold text-ink">
          Add your Spotify
        </h2>
      </div>
      <p className="mt-2 text-[13px] leading-5 text-ink-muted">
        Your top artists, genres, the decades you love, and when you listen say a lot about your trip vibe. We use them to pace late
        nights, find shows by your artists, and spot tribute and cover bands.
      </p>
      <label className={`${styles.label} mt-3`}>
        {canRead ? 'Got a favorites playlist? Paste it (optional)' : 'Got a favorites playlist? Paste it and sign in to read it (optional)'}
        <input
          className={styles.input}
          value={playlist}
          inputMode="url"
          autoComplete="off"
          placeholder={configured ? 'https://open.spotify.com/playlist/… or “liked”' : 'https://open.spotify.com/playlist/…'}
          onChange={(e) => setPlaylist(e.target.value)}
          aria-invalid={!playlistOk}
        />
      </label>
      {!playlistOk ? <p className={styles.hint}>Paste a link from Share → Copy link to playlist{configured ? ', or type “liked” for your Liked Songs' : ''}.</p> : null}
      <div className={`${styles.row} mt-3`}>
        {playlist.trim() ? (
          <button type="button" className={styles.spotifyBtn} onClick={readLink} disabled={busy || !playlistOk}>
            {busy ? (canRead ? 'Reading the playlist…' : 'Opening Spotify…') : canRead ? 'Read this playlist' : 'Sign in and read it'}
          </button>
        ) : configured ? (
          <button type="button" className={styles.spotifyBtn} onClick={connect} disabled={busy}>
            <SourceLogo source="spotify" size={16} className="mr-1.5" />{busy ? 'Opening Spotify…' : 'Connect Spotify'}
          </button>
        ) : null}
        {!configured && !playlist.trim() ? <span className={styles.hint}>Spotify sign-in isn’t set up on this site; a public playlist link works without it.</span> : null}
      </div>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.hint}>
        {canRead
          ? 'A public playlist link is read without signing in: we look at its songs and artists, summarize them, and keep only the summary on this device. '
          : 'We read the playlist after you sign in, summarize it, and keep only the summary on this device. '}
        {configured ? 'Connect Spotify (read-only) for your top artists, recent plays, and Liked Songs. ' : ''}
        Spotify’s own editorial and mix playlists can’t be read by apps.
        {configured ? ' While the app is in Spotify’s development mode, only accounts the owner has added can connect.' : ''}
      </p>
    </section>
  );
}
