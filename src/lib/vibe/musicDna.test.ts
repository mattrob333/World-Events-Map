import { describe, expect, it } from 'vitest';
import type { ListeningProfile } from '@/lib/designer/listening';
import { musicDna, musicSignals } from './musicDna';
import { allSignals, VOCAB } from './signals';

const listening = (genreShares: { genre: string; share: number }[]): ListeningProfile => ({
  source: 'spotify', importedAt: '2026-09-25T00:00:00Z', topArtists: ['Yelawolf', 'Tucker Wetmore'], genres: genreShares.map((g) => g.genre), genreShares,
  eras: [], energy: 'high', roots: [], familyListening: false, playlistHints: [],
});
const label = (key: string) => VOCAB.find((entry) => entry.key === key)?.label;

describe('music DNA', () => {
  const mine = listening([
    { genre: 'country', share: 0.3 }, { genre: 'rock', share: 0.15 }, { genre: 'alternative metal', share: 0.12 },
    { genre: 'southern hip hop', share: 0.1 }, { genre: 'nu metal', share: 0.08 }, { genre: 'red dirt', share: 0.07 },
  ]);

  it('rolls genres into families with shares, metal ahead of rock', () => {
    const dna = musicDna(mine);
    expect(dna[0]).toMatchObject({ key: 'country' });
    expect(dna.find((row) => row.key === 'metal')?.genres).toEqual(['alternative metal', 'nu metal']);
    expect(dna.reduce((sum, row) => sum + row.share, 0)).toBeCloseTo(1, 1);
  });

  it('turns a big share into loved scene tags that say why', () => {
    const signals = musicSignals(mine, label);
    const honky = signals.find((s) => s.key === 'nights:honky-tonk');
    expect(honky).toMatchObject({ strength: 'love', source: 'spotify' });
    expect(honky?.note).toMatch(/% of your listening is country/);
    expect(signals.some((s) => s.key === 'nights:hip-hop')).toBe(true);
  });

  it('flows into the profile, so matching uses it', () => {
    const keys = allSignals({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '', listening: mine }).map((s) => s.key);
    expect(keys).toContain('nights:honky-tonk');
  });

  it('works for older imports without measured shares', () => {
    const old = { ...mine, genreShares: undefined, genres: ['house', 'techno', 'pop'] };
    expect(musicDna(old)[0]?.key).toBe('electronic');
  });
});
