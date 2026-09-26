/**
 * What a traveler's Spotify listening says about how they like to travel.
 * Pure and deterministic: the browser imports the raw data, this module
 * summarizes it, and only the summary is kept (never the Spotify token).
 */

export type ListeningProfile = {
  source: 'spotify';
  importedAt: string;
  topArtists: string[];
  genres: string[];
  /** How much of their top listening each genre is (0–1, weighted by artist rank), biggest first. */
  genreShares?: { genre: string; share: number }[];
  /** Share of top tracks by release decade, biggest first. */
  eras: { decade: string; share: number }[];
  /** Share of recent plays between 22:00 and 04:00 local time. */
  nightOwl?: number;
  /** Share of recent plays between 05:00 and 09:00 local time. */
  earlyBird?: number;
  energy: 'high' | 'mixed' | 'chill';
  roots: string[];
  familyListening: boolean;
  playlistHints: string[];
  /** The playlist the traveler pointed us at ("Liked Songs" or its name), when they did. */
  fromPlaylist?: string;
};

export type SpotifyImport = {
  artists: { name: string; genres?: string[] }[];
  tracks: { album?: { release_date?: string }; artists?: { name: string }[] }[];
  recent: { played_at: string }[];
  playlists: { name: string }[];
  /** A playlist the traveler linked; its artists outrank their top artists. */
  focus?: { name: string; artists: { name: string; genres?: string[] }[]; tracks: SpotifyImport['tracks'] };
};

export type PlaylistRef = { kind: 'liked' } | { kind: 'playlist'; id: string };

/**
 * Reads a pasted Spotify link: a playlist URL (with or without /intl-xx/ and
 * ?si=), a spotify:playlist: URI, or the Liked Songs page / the word "liked".
 */
export function parsePlaylistRef(input: string): PlaylistRef | null {
  const text = input.trim();
  if (!text) return null;
  if (/^(liked( songs)?|favou?rites)$/i.test(text) || /open\.spotify\.com\/collection\/tracks/i.test(text)) return { kind: 'liked' };
  const match = text.match(/^spotify:playlist:([A-Za-z0-9]{16,40})$/) ?? text.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:embed\/)?playlist\/([A-Za-z0-9]{16,40})(?:[/?#].*)?$/i);
  return match ? { kind: 'playlist', id: match[1] } : null;
}

/** Artists on a playlist, most-played first, with how many tracks each has. */
export function playlistArtists(tracks: { artists?: { id?: string; name: string }[] }[]): { id?: string; name: string; count: number }[] {
  const byName = new Map<string, { id?: string; name: string; count: number }>();
  for (const track of tracks) {
    for (const artist of track.artists ?? []) {
      const name = artist.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = byName.get(key) ?? { id: artist.id, name, count: 0 };
      entry.count += 1;
      byName.set(key, entry);
    }
  }
  return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type ListeningInsight = { id: string; emoji: string; title: string; detail: string };

const HIGH_ENERGY = /techno|house|edm|electro|dubstep|drum and bass|trance|hardstyle|drill|trap|metal|punk|hard rock|reggaeton|dancehall|funk carioca|baile/;
const CHILL = /jazz|ambient|classical|lo-?fi|acoustic|folk|bossa|soul|singer-songwriter|chill|new age|piano|opera|blues/;

const ROOTS: [RegExp, string][] = [
  [/brazil|mpb|samba|bossa|sertanejo|pagode|forro|forró|funk carioca|baile funk|axé|axe/, 'Brazil'],
  [/reggaeton|latin|salsa|bachata|cumbia|merengue|urbano/, 'Latin America'],
  [/mexican|regional mexican|corrido|banda|norteño|mariachi/, 'Mexico'],
  [/afrobeats|afropop|highlife|amapiano|afro/, 'West & South Africa'],
  [/k-pop|korean/, 'Korea'],
  [/j-pop|japanese|city pop|anime/, 'Japan'],
  [/french|chanson/, 'France'],
  [/italian/, 'Italy'],
  [/flamenco|spanish/, 'Spain'],
  [/reggae|dancehall|jamaican/, 'Jamaica'],
  [/irish|celtic/, 'Ireland'],
  [/bollywood|desi|punjabi|indian/, 'India'],
  [/fado|portuguese/, 'Portugal'],
  [/greek/, 'Greece'],
];

const FAMILY = /children|kids|disney|kidz bop|cocomelon|nursery|lullab|pinkfong|musicals?$/i;

const PLAYLIST_HINTS: [RegExp, string][] = [
  [/road ?trip|drive|driving/, 'Road trips'],
  [/work ?out|gym|run|running|cardio|lift/, 'Workouts'],
  [/ski|apr[eè]s|snow|mountain/, 'Ski trips'],
  [/beach|summer|pool|island|tropical/, 'Beach days'],
  [/party|pregame|club|night out/, 'Nights out'],
  [/dinner|cocktail|wine|cooking/, 'Dinner parties'],
  [/sleep|study|focus|calm|chill/, 'Wind-down'],
  [/kids|family|disney/, 'Family car rides'],
  [/wedding|love|romance/, 'Romance'],
  [/game ?day|tailgate|stadium/, 'Game days'],
];

function share(count: number, total: number): number {
  return total ? Math.round((count / total) * 100) / 100 : 0;
}

function hourLocal(iso: string): number {
  return new Date(iso).getHours();
}

export function analyzeSpotify(input: SpotifyImport, now = new Date(), hourOf: (iso: string) => number = hourLocal): ListeningProfile {
  // A linked playlist leads: its artists first, its tracks for the eras.
  const focus = input.focus;
  const seen = new Set<string>();
  const artists = [...(focus?.artists ?? []), ...input.artists].filter((artist) => {
    const key = artist.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const data: SpotifyImport = {
    ...input,
    artists,
    tracks: focus?.tracks.length ? focus.tracks : input.tracks,
    playlists: focus ? [{ name: focus.name }, ...input.playlists] : input.playlists,
  };
  const genreCounts = new Map<string, number>();
  for (const [index, artist] of data.artists.entries()) {
    const weight = Math.max(1, 20 - index);
    for (const genre of artist.genres ?? []) genreCounts.set(genre.toLowerCase(), (genreCounts.get(genre.toLowerCase()) ?? 0) + weight);
  }
  const genres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).map(([genre]) => genre).slice(0, 12);
  const genreTotal = [...genreCounts.values()].reduce((sum, value) => sum + value, 0);
  const genreShares = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([genre, count]) => ({ genre, share: genreTotal ? Math.round((count / genreTotal) * 1000) / 1000 : 0 }));

  const decades = new Map<string, number>();
  let dated = 0;
  for (const track of data.tracks) {
    const year = Number(track.album?.release_date?.slice(0, 4));
    if (year >= 1900 && year <= now.getFullYear()) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decades.set(decade, (decades.get(decade) ?? 0) + 1);
      dated += 1;
    }
  }
  const eras = [...decades.entries()]
    .map(([decade, count]) => ({ decade, share: share(count, dated) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);

  const hours = data.recent.map((play) => hourOf(play.played_at)).filter((hour) => Number.isInteger(hour));
  const nightOwl = hours.length >= 10 ? share(hours.filter((h) => h >= 22 || h < 4).length, hours.length) : undefined;
  const earlyBird = hours.length >= 10 ? share(hours.filter((h) => h >= 5 && h < 9).length, hours.length) : undefined;

  const genreText = genres.join(' | ');
  const high = genres.filter((genre) => HIGH_ENERGY.test(genre)).length;
  const chill = genres.filter((genre) => CHILL.test(genre)).length;
  const energy: ListeningProfile['energy'] = high > chill * 1.5 && high >= 2 ? 'high' : chill > high * 1.5 && chill >= 2 ? 'chill' : 'mixed';

  const roots = ROOTS.filter(([pattern]) => pattern.test(genreText)).map(([, root]) => root);
  const familyListening =
    genres.some((genre) => FAMILY.test(genre)) || data.artists.some((artist) => /kidz bop|cocomelon|disney|pinkfong/i.test(artist.name));
  const playlistNames = data.playlists.map((playlist) => playlist.name.toLowerCase()).join(' | ');
  const playlistHints = PLAYLIST_HINTS.filter(([pattern]) => pattern.test(playlistNames)).map(([, hint]) => hint);

  return {
    source: 'spotify',
    importedAt: now.toISOString(),
    topArtists: [...new Set(data.artists.map((artist) => artist.name.trim()).filter(Boolean))].slice(0, 10),
    genres,
    genreShares,
    eras,
    nightOwl,
    earlyBird,
    energy,
    roots,
    familyListening,
    playlistHints,
    ...(focus ? { fromPlaylist: focus.name.slice(0, 80) } : {}),
  };
}

/** Travel-planning reads of a listening profile. Each one says what it is based on. */
export function listeningInsights(profile: ListeningProfile): ListeningInsight[] {
  const out: ListeningInsight[] = [];
  const g = profile.genres.join(' | ');
  const topEra = profile.eras[0];
  if (profile.nightOwl !== undefined && profile.nightOwl >= 0.25) {
    out.push({ id: 'night', emoji: '🌙', title: 'Night owl', detail: `${Math.round(profile.nightOwl * 100)}% of recent plays were after 10 pm, so late-night slots stay in the plan.` });
  }
  if (profile.earlyBird !== undefined && profile.earlyBird >= 0.2) {
    out.push({ id: 'early', emoji: '🌅', title: 'Early riser', detail: `${Math.round(profile.earlyBird * 100)}% of recent plays were before 9 am: first chairs and sunrise hikes.` });
  }
  if (profile.energy === 'high') out.push({ id: 'energy', emoji: '⚡', title: 'High-energy listener', detail: 'Mostly dance, electronic, or heavy genres: DJ après and club nights fit.' });
  if (profile.energy === 'chill') out.push({ id: 'chill', emoji: '🕯️', title: 'Easy-going listener', detail: 'Mostly mellow genres: listening bars, wine rooms, and slower evenings.' });
  if (/jazz|soul|blues/.test(g)) out.push({ id: 'jazz', emoji: '🎷', title: 'Jazz club night', detail: 'Jazz, soul, or blues in the top genres.' });
  if (/country|bluegrass|americana|honky/.test(g)) out.push({ id: 'country', emoji: '🤠', title: 'Live country bars', detail: 'Country or Americana in the top genres.' });
  if (/hip hop|rap|trap/.test(g)) out.push({ id: 'hiphop', emoji: '🎤', title: 'Hip-hop nights', detail: 'Hip hop in the top genres.' });
  if (/classical|opera|orchestra/.test(g)) out.push({ id: 'classical', emoji: '🎻', title: 'Concert hall or opera', detail: 'Classical or opera in the top genres.' });
  if (topEra && topEra.share >= 0.3 && Number(topEra.decade.slice(0, 4)) <= 2000) {
    out.push({ id: 'era', emoji: '📼', title: `${topEra.decade} at heart`, detail: `${Math.round(topEra.share * 100)}% of top tracks are from the ${topEra.decade}: cover bands and throwback nights.` });
  }
  for (const root of profile.roots.slice(0, 2)) {
    out.push({ id: `root-${root}`, emoji: '🌍', title: `${root} in the playlist`, detail: `Genres rooted in ${root}: look for that music, food, and nights out wherever you go.` });
  }
  if (profile.familyListening) out.push({ id: 'family', emoji: '🧸', title: 'Kids’ tunes in the mix', detail: 'Family listening shows up: favor all-ages shows and daytime events.' });
  for (const hint of profile.playlistHints.slice(0, 3)) {
    out.push({ id: `hint-${hint}`, emoji: '🎧', title: `Has ${hint.toLowerCase()} playlists`, detail: 'From your playlist names.' });
  }
  return out;
}

/** Planning tags the trip composer understands. */
export function listeningTags(profile: ListeningProfile): string[] {
  const tags = new Set<string>(['music']);
  if ((profile.nightOwl ?? 0) >= 0.25 || profile.energy === 'high') tags.add('nightlife');
  if (profile.energy === 'chill') tags.add('wellness');
  if (profile.roots.includes('Brazil')) tags.add('brazil');
  if (profile.playlistHints.includes('Workouts')) tags.add('active');
  if (profile.playlistHints.includes('Ski trips')) tags.add('ski');
  if (profile.playlistHints.includes('Beach days')) tags.add('water');
  if (profile.playlistHints.includes('Game days')) tags.add('sports');
  return [...tags];
}

export function normalizeListening(input: unknown): ListeningProfile | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const s = input as Record<string, unknown>;
  if (s.source !== 'spotify') return undefined;
  const strings = (value: unknown, max: number) =>
    (Array.isArray(value) ? value : []).filter((v): v is string => typeof v === 'string' && v.length > 0).map((v) => v.slice(0, 60)).slice(0, max);
  const ratio = (value: unknown) => (typeof value === 'number' && value >= 0 && value <= 1 ? value : undefined);
  const eras = (Array.isArray(s.eras) ? s.eras : [])
    .flatMap((e) => {
      const era = e as Record<string, unknown>;
      return typeof era?.decade === 'string' && /^\d{4}s$/.test(era.decade) && ratio(era.share) !== undefined ? [{ decade: era.decade, share: era.share as number }] : [];
    })
    .slice(0, 5);
  return {
    source: 'spotify',
    importedAt: typeof s.importedAt === 'string' ? s.importedAt.slice(0, 40) : new Date(0).toISOString(),
    topArtists: strings(s.topArtists, 10),
    genres: strings(s.genres, 12),
    genreShares: (Array.isArray(s.genreShares) ? s.genreShares : []).flatMap((g) => {
      const row = g as Record<string, unknown>;
      return typeof row?.genre === 'string' && row.genre.trim() && ratio(row.share) !== undefined ? [{ genre: row.genre.trim().toLowerCase().slice(0, 60), share: row.share as number }] : [];
    }).slice(0, 24),
    eras,
    nightOwl: ratio(s.nightOwl),
    earlyBird: ratio(s.earlyBird),
    energy: s.energy === 'high' || s.energy === 'chill' ? s.energy : 'mixed',
    roots: strings(s.roots, 6),
    familyListening: s.familyListening === true,
    playlistHints: strings(s.playlistHints, 10),
    fromPlaylist: typeof s.fromPlaylist === 'string' && s.fromPlaylist.trim() ? s.fromPlaylist.trim().slice(0, 80) : undefined,
  };
}
