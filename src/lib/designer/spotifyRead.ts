/**
 * Reads one Spotify playlist (or Liked Songs) into a listening "focus".
 * Shared by the browser import (the traveler's own token) and the server's
 * public-playlist reader (an app token), so both summarize the same way.
 */

import { playlistArtists, type PlaylistRef, type SpotifyImport } from './listening';

export const SPOTIFY_API = 'https://api.spotify.com/v1';
const MAX_PLAYLIST_TRACKS = 300;
const MAX_GENRE_LOOKUPS = 12;

/** Fetches a Spotify API path (or absolute api.spotify.com URL) as JSON; null on any failure. */
export type SpotifyGet = <T>(path: string) => Promise<T | null>;

type Page<T> = { items?: T[]; next?: string | null };
type Track = { album?: { release_date?: string }; artists?: { id?: string; name: string }[] };
// Playlist items carry the track as `item` (2026 API) or `track` (older responses).
type PlaylistItem = { item?: Track | null; track?: Track | null };

/** Follows `next` links, only to api.spotify.com, up to `max` items. */
async function paged<T>(get: SpotifyGet, path: string, max: number): Promise<T[] | null> {
  const first = await get<Page<T>>(path);
  if (!first) return null;
  const out = [...(first.items ?? [])];
  let next = first.next;
  while (next && out.length < max && next.startsWith(`${SPOTIFY_API}/`)) {
    const page = await get<Page<T>>(next);
    if (!page) break;
    out.push(...(page.items ?? []));
    next = page.next;
  }
  return out.slice(0, max);
}

export class PlaylistUnavailableError extends Error {}

export async function readPlaylist(get: SpotifyGet, ref: PlaylistRef): Promise<SpotifyImport['focus'] | undefined> {
  let name = 'Liked Songs';
  let items: PlaylistItem[] | null;
  if (ref.kind === 'liked') {
    items = await paged<PlaylistItem>(get, '/me/tracks?limit=50', MAX_PLAYLIST_TRACKS);
  } else {
    const meta = await get<{ name?: string }>(`/playlists/${ref.id}?fields=name`);
    if (!meta) {
      throw new PlaylistUnavailableError(
        'Spotify wouldn’t open that playlist. It may be private, or one of Spotify’s own editorial or mix playlists, which apps can’t read.',
      );
    }
    name = meta.name?.trim().slice(0, 80) || 'your playlist';
    items =
      (await paged<PlaylistItem>(get, `/playlists/${ref.id}/items?limit=100`, MAX_PLAYLIST_TRACKS)) ??
      (await paged<PlaylistItem>(get, `/playlists/${ref.id}/tracks?limit=100`, MAX_PLAYLIST_TRACKS));
  }
  const tracks = (items ?? []).map((entry) => entry.item ?? entry.track).filter((track): track is Track => Boolean(track?.artists?.length));
  if (!tracks.length) return undefined;
  const ranked = playlistArtists(tracks);
  // One lookup per top artist for genres; the batch endpoint is gone.
  const withGenres = await Promise.all(
    ranked.slice(0, MAX_GENRE_LOOKUPS).map(async (artist) => {
      const full = artist.id && /^[A-Za-z0-9]{10,40}$/.test(artist.id) ? await get<{ genres?: string[] }>(`/artists/${artist.id}`) : null;
      return { name: artist.name, genres: Array.isArray(full?.genres) ? full.genres.slice(0, 8) : [] };
    }),
  );
  return { name, artists: [...withGenres, ...ranked.slice(MAX_GENRE_LOOKUPS).map((artist) => ({ name: artist.name }))], tracks };
}
