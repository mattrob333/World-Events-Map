/**
 * Spotify, made matchable. Their genres (weighted by how high the artist
 * ranks) roll up into a handful of music families with a share each; every
 * family that's a real part of their listening becomes scene tags the
 * concierge can match against venues, nights out and events. All inferred,
 * so they can correct it.
 */
import type { ListeningProfile } from '@/lib/designer/listening';
import type { Signal } from './signals';

export type MusicFamily = {
  key: string;
  label: string;
  emoji: string;
  /** Spotify genre names that belong to it. */
  genres: RegExp;
  /** Scene tags (Vibe vocabulary keys) it points to, strongest first. */
  scenes: string[];
};

export const MUSIC_FAMILIES: readonly MusicFamily[] = [
  { key: 'country', label: 'Country', emoji: '🤠', genres: /country|americana|red dirt|bluegrass|outlaw|honky/, scenes: ['nights:honky-tonk', 'nights:live-music', 'culture:festivals', 'food:bbq'] },
  { key: 'hip-hop', label: 'Hip-hop & rap', emoji: '🎤', genres: /hip hop|rap|trap|drill|crunk|grime/, scenes: ['nights:hip-hop', 'nights:dance', 'nights:lounge'] },
  { key: 'rock', label: 'Rock', emoji: '🎸', genres: /rock|grunge|alternative|indie|britpop|post-punk|emo/, scenes: ['nights:rock', 'nights:live-music', 'nights:dive-bar'] },
  { key: 'metal', label: 'Metal & punk', emoji: '🤘', genres: /metal|punk|hardcore|screamo|djent/, scenes: ['nights:rock', 'nights:dive-bar'] },
  { key: 'electronic', label: 'House & electronic', emoji: '🪩', genres: /house|techno|edm|electro|trance|dubstep|drum and bass|dnb|dance|disco/, scenes: ['nights:dance', 'nights:rooftop', 'nights:apres', 'nights:last-call'] },
  { key: 'latin', label: 'Latin', emoji: '💃', genres: /latin|reggaeton|salsa|bachata|cumbia|samba|bossa|sertanejo|mpb|urbano/, scenes: ['nights:latin', 'nights:dance'] },
  { key: 'rnb', label: 'R&B & soul', emoji: '🎷', genres: /r&b|soul|funk|neo soul|motown/, scenes: ['nights:lounge', 'nights:jazz', 'nights:cocktail-bar'] },
  { key: 'jazz', label: 'Jazz & blues', emoji: '🎺', genres: /jazz|blues|swing|bebop/, scenes: ['nights:jazz', 'nights:speakeasy', 'nights:cocktail-bar'] },
  { key: 'pop', label: 'Pop', emoji: '✨', genres: /pop|boy band|girl group|k-pop/, scenes: ['nights:karaoke', 'nights:rooftop', 'culture:festivals'] },
  { key: 'folk', label: 'Folk & singer-songwriter', emoji: '🪕', genres: /folk|singer-songwriter|acoustic/, scenes: ['nights:live-music', 'nights:wine-bar'] },
  { key: 'reggae', label: 'Reggae & island', emoji: '🌴', genres: /reggae|dancehall|ska|soca|afrobeat|afrobeats|amapiano/, scenes: ['nights:dance', 'nights:rooftop'] },
  { key: 'classical', label: 'Classical & opera', emoji: '🎻', genres: /classical|opera|orchestra|baroque|chamber/, scenes: ['culture:concert-hall', 'culture:theatre'] },
];

export type MusicDnaRow = { key: string; label: string; emoji: string; share: number; genres: string[] };

/** Their listening by family, biggest first; shares add up to 1 over what we could place. */
export function musicDna(listening: ListeningProfile | undefined): MusicDnaRow[] {
  if (!listening) return [];
  // Newer imports carry measured shares; older ones fall back to rank (first genre weighs most).
  const weighted = listening.genreShares?.length
    ? listening.genreShares
    : listening.genres.map((genre, i) => ({ genre, share: 1 / (i + 2) }));
  const rows = new Map<string, MusicDnaRow>();
  let total = 0;
  for (const { genre, share } of weighted) {
    const g = genre.toLowerCase();
    // Metal is more specific than rock; check the specific families first.
    const family = MUSIC_FAMILIES.find((f) => f.key === 'metal' && f.genres.test(g)) ?? MUSIC_FAMILIES.find((f) => f.genres.test(g));
    if (!family) continue;
    const row = rows.get(family.key) ?? { key: family.key, label: family.label, emoji: family.emoji, share: 0, genres: [] };
    row.share += share;
    if (row.genres.length < 4) row.genres.push(g);
    rows.set(family.key, row);
    total += share;
  }
  return [...rows.values()]
    .map((row) => ({ ...row, share: total ? Math.round((row.share / total) * 100) / 100 : 0 }))
    .filter((row) => row.share >= 0.04)
    .sort((a, b) => b.share - a.share);
}

const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * The scene tags their listening implies. A family that's a third of what
 * they play is a love; a real slice (10%+) is a like. Each says why.
 */
export function musicSignals(listening: ListeningProfile | undefined, labelFor: (key: string) => string | undefined): Signal[] {
  const out = new Map<string, Signal & { weight: number }>();
  for (const row of musicDna(listening)) {
    if (row.share < 0.1) continue;
    const family = MUSIC_FAMILIES.find((f) => f.key === row.key)!;
    family.scenes.forEach((key, i) => {
      const label = labelFor(key);
      if (!label) return;
      // The family's first scene carries its full weight; later ones a little less.
      const weight = row.share * (1 - i * 0.15);
      const previous = out.get(key);
      if (previous && previous.weight >= weight) return;
      out.set(key, { key, label, strength: weight >= 0.3 ? 'love' : 'like', source: 'spotify', note: `${pct(row.share)} of your listening is ${row.label.toLowerCase()}`, weight });
    });
  }
  return [...out.values()].sort((a, b) => b.weight - a.weight).map(({ weight: _weight, ...signal }) => signal);
}
