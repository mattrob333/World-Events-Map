'use client';

import { analyzeSpotify, type ListeningProfile, type SpotifyImport } from './listening';

/**
 * Spotify import via Authorization Code + PKCE, entirely in the browser.
 * The access token lives only in memory for the few requests below and is
 * never stored or sent to dope.travel; only the summarized ListeningProfile is kept.
 */

const AUTHORIZE = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
// Read-only scopes. No playback control, no library writes.
export const SPOTIFY_SCOPES = ['user-top-read', 'user-read-recently-played', 'playlist-read-private'];
const PENDING_KEY = 'meridian.spotify.pkce';

export function spotifyClientId(): string | undefined {
  return process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || undefined;
}

export function spotifyRedirectUri(): string {
  return `${window.location.origin}/moodboard/spotify`;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(bytes = 48): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer);
}

export async function startSpotifyConnect(): Promise<void> {
  const clientId = spotifyClientId();
  if (!clientId) throw new Error('Spotify is not configured for this app yet.');
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ verifier, state }));
  const url = new URL(AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SPOTIFY_SCOPES.join(' '),
    state,
  }).toString();
  window.location.assign(url.toString());
}

type Items<T> = { items?: T[] };

async function get<T>(token: string, path: string): Promise<T[]> {
  try {
    const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return [];
    const body = (await response.json()) as Items<T>;
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}

export async function completeSpotifyConnect(code: string, state: string): Promise<ListeningProfile> {
  const clientId = spotifyClientId();
  const pending = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null') as { verifier: string; state: string } | null;
    } catch {
      return null;
    }
  })();
  sessionStorage.removeItem(PENDING_KEY);
  if (!clientId || !pending || pending.state !== state) throw new Error('That Spotify sign-in expired or did not start here. Try connecting again.');

  const tokenResponse = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyRedirectUri(),
      client_id: clientId,
      code_verifier: pending.verifier,
    }),
  });
  if (!tokenResponse.ok) throw new Error('Spotify did not accept the sign-in. Try connecting again.');
  const { access_token: token } = (await tokenResponse.json()) as { access_token?: string };
  if (!token) throw new Error('Spotify did not return access.');

  const [artists, tracks, recent, playlists] = await Promise.all([
    get<SpotifyImport['artists'][number]>(token, '/me/top/artists?limit=20&time_range=medium_term'),
    get<SpotifyImport['tracks'][number]>(token, '/me/top/tracks?limit=50&time_range=medium_term'),
    get<SpotifyImport['recent'][number]>(token, '/me/player/recently-played?limit=50'),
    get<SpotifyImport['playlists'][number]>(token, '/me/playlists?limit=50'),
  ]);
  if (!artists.length && !tracks.length) {
    throw new Error('Spotify returned no listening history for this account. It may be new, or not on this app’s allowed-user list yet.');
  }
  return analyzeSpotify({ artists, tracks, recent, playlists });
}
