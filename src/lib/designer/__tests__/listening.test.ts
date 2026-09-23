import { describe, expect, it } from 'vitest';
import { concertLinks, toConcert } from '../concerts';
import { analyzeSpotify, listeningInsights, listeningTags, normalizeListening } from '../listening';
import { parseProfileLocally, profileTags } from '../profile';

const hours = (list: number[]) => list.map((h) => ({ played_at: `2026-09-${String(10 + (h % 10)).padStart(2, '0')}T${String(h).padStart(2, '0')}:15:00Z` }));
const utcHour = (iso: string) => new Date(iso).getUTCHours();

describe('analyzeSpotify', () => {
  const data = {
    artists: [
      { name: 'Jorge Ben Jor', genres: ['mpb', 'samba', 'bossa nova'] },
      { name: 'Outkast', genres: ['hip hop', 'southern hip hop'] },
      { name: 'Seu Jorge', genres: ['mpb'] },
      { name: 'Kidz Bop Kids', genres: ["children's music"] },
    ],
    tracks: [
      { album: { release_date: '1976-01-01' } },
      { album: { release_date: '1974' } },
      { album: { release_date: '2003-09-23' } },
      { album: { release_date: 'garbage' } },
    ],
    recent: hours([23, 23, 0, 1, 2, 12, 13, 14, 6, 7, 22, 3]),
    playlists: [{ name: 'Road Trip ATL → Savannah' }, { name: 'Morning run' }, { name: 'Braves game day' }],
  };
  const profile = analyzeSpotify(data, new Date('2026-09-23T12:00:00Z'), utcHour);

  it('ranks genres by artist weight and reads eras from release dates', () => {
    expect(profile.genres[0]).toBe('mpb');
    expect(profile.eras[0]).toEqual({ decade: '1970s', share: 0.67 });
    expect(profile.topArtists).toContain('Outkast');
  });

  it('infers listening hours, roots, family listening, and playlist habits', () => {
    expect(profile.nightOwl).toBe(0.58);
    expect(profile.earlyBird).toBe(0.17);
    expect(profile.roots).toContain('Brazil');
    expect(profile.familyListening).toBe(true);
    expect(profile.playlistHints).toEqual(expect.arrayContaining(['Road trips', 'Workouts', 'Game days']));
  });

  it('does not guess hours from a thin history', () => {
    expect(analyzeSpotify({ ...data, recent: hours([23, 1]) }).nightOwl).toBeUndefined();
  });

  it('turns listening into insights and planning tags', () => {
    const ids = listeningInsights(profile).map((insight) => insight.id);
    expect(ids).toEqual(expect.arrayContaining(['night', 'hiphop', 'era', 'root-Brazil', 'family']));
    expect(listeningTags(profile)).toEqual(expect.arrayContaining(['music', 'nightlife', 'brazil', 'active', 'sports']));
    const traveler = { ...parseProfileLocally('I love golf.'), listening: profile };
    expect(profileTags(traveler)).toContain('nightlife');
  });

  it('normalizes stored listening data', () => {
    expect(normalizeListening({ source: 'other' })).toBeUndefined();
    const safe = normalizeListening({ source: 'spotify', nightOwl: 4, eras: [{ decade: 'x', share: 1 }], energy: 'loud', topArtists: ['A', 3] });
    expect(safe).toMatchObject({ nightOwl: undefined, eras: [], energy: 'mixed', topArtists: ['A'] });
  });
});

describe('concerts', () => {
  const event = (name: string, extra: Record<string, unknown> = {}) => ({
    id: 'E1',
    name,
    url: 'https://www.ticketmaster.com/event/E1',
    dates: { start: { localDate: '2026-11-07', localTime: '20:00:00' } },
    _embedded: { venues: [{ name: 'Tabernacle', city: { name: 'Atlanta' }, country: { countryCode: 'US' } }] },
    images: [{ ratio: '16_9', width: 1024, url: 'https://s1.ticketm.net/img.jpg' }],
    priceRanges: [{ min: 45, max: 120.5, currency: 'USD' }],
    ...extra,
  });

  it('keeps real artist shows and tribute acts apart', () => {
    expect(toConcert(event('Outkast Live'), 'Outkast', 'artist')).toMatchObject({ venue: 'Tabernacle', city: 'Atlanta', time: '20:00', price: 'USD 45–121' });
    expect(toConcert(event('Hey Ya! An Outkast Tribute'), 'Outkast', 'artist')).toBeNull();
    expect(toConcert(event('Hey Ya! An Outkast Tribute'), 'Outkast', 'tribute')).toMatchObject({ kind: 'tribute' });
    expect(toConcert(event('Random Jazz Night'), 'Outkast', 'tribute')).toBeNull();
  });

  it('rejects off-domain links and images', () => {
    expect(toConcert(event('Outkast', { url: 'https://evil.example/e' }), 'Outkast', 'artist')).toBeNull();
    expect(toConcert(event('Outkast', { images: [{ ratio: '16_9', url: 'https://evil.example/x.jpg' }] }), 'Outkast', 'artist')?.image).toBeUndefined();
  });

  it('builds search links when no provider is configured', () => {
    const links = concertLinks(['Outkast'], 'Atlanta');
    expect(links).toHaveLength(3);
    expect(links[2].href).toContain('Outkast%20tribute%20Atlanta');
  });
});
