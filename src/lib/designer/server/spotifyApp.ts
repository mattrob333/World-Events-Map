import 'server-only';
import { analyzeSpotify, parsePlaylistRef, type ListeningProfile } from '../listening';
import { PlaylistUnavailableError, SPOTIFY_API, readPlaylist, type SpotifyGet } from '../spotifyRead';

/**
 * Reads a public Spotify playlist with the app's own credentials (client
 * credentials flow), so a traveler or their AI agent can paste a link
 * without signing in. Only public playlists work this way; Liked Songs and
 * private playlists need the traveler's own sign-in in the browser.
 */

let cached: { token: string; expiresAt: number } | null = null;

function credentials(): { id: string; secret: string } | null {
  const id = process.env.SPOTIFY_CLIENT_ID || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export function spotifyAppConfigured(): boolean {
  return credentials() !== null;
}

async function appToken(now = Date.now()): Promise<string | null> {
  if (cached && cached.expiresAt > now + 30_000) return cached.token;
  const creds = credentials();
  if (!creds) return null;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;
  cached = { token: body.access_token, expiresAt: now + Math.max(60, body.expires_in ?? 3600) * 1000 };
  return cached.token;
}

export class PlaylistInputError extends Error {}

export async function readPublicPlaylist(link: string): Promise<ListeningProfile> {
  const ref = parsePlaylistRef(link);
  if (!ref) throw new PlaylistInputError('That isn’t a Spotify playlist link. Copy it from Share → Copy link to playlist.');
  if (ref.kind === 'liked') throw new PlaylistInputError('Liked Songs are private. Use “Connect Spotify” in the app to read them.');
  const token = await appToken();
  if (!token) throw new PlaylistUnavailableError('Spotify didn’t respond. Try again in a minute.');
  const get: SpotifyGet = async <T>(path: string) => {
    const url = path.startsWith(`${SPOTIFY_API}/`) ? path : `${SPOTIFY_API}${path}`;
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      return response.ok ? ((await response.json()) as T) : null;
    } catch {
      return null;
    }
  };
  const focus = await readPlaylist(get, ref);
  if (!focus) throw new PlaylistUnavailableError('That playlist came back empty, so there was nothing to read.');
  return analyzeSpotify({ artists: [], tracks: [], recent: [], playlists: [], focus });
}
