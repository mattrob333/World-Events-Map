import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { classify, fromSeatGeek, searchArtistEvents, searchCityScene } from '../concerts';
import { readTaste } from '../music-input';
import { mergeTastes, scenePlaybook, sceneSearchLinks, tasteFrom } from '../scene';
import { jevEventFit, parsePersona } from '../server/jevMusic';
import { parseProfileLocally } from '../profile';

describe('scenePlaybook', () => {
  it('turns classic rock plus a 70s-heavy library into rock cover bands first', () => {
    const scenes = scenePlaybook({ genres: ['classic rock', 'hip hop', 'southern hip hop', 'mpb', 'samba'], eras: [{ decade: '1970s', share: 0.5 }, { decade: '2000s', share: 0.25 }] });
    expect(scenes[0].key).toBe('rock-covers');
    expect(scenes[0].why).toMatch(/before 2000/);
    expect(scenes.map((scene) => scene.key)).toEqual(expect.arrayContaining(['hip-hop', 'brazilian', 'piano-bar']));
  });

  it('works from music mentioned in a ramble, without Spotify', () => {
    const taste = tasteFrom(parseProfileLocally('I love jazz and blues, and some country.'));
    const keys = scenePlaybook({ ...taste, energy: 'chill' }).map((scene) => scene.key);
    expect(keys).toEqual(expect.arrayContaining(['jazz', 'blues', 'country']));
  });

  it('returns nothing for no taste, and map links for any city', () => {
    expect(scenePlaybook({ genres: [] })).toEqual([]);
    const [link] = sceneSearchLinks({ label: 'Rock cover bands', searches: ['rock cover band bar'] }, 'Lisbon');
    expect(link.href).toBe('https://www.google.com/maps/search/?api=1&query=rock%20cover%20band%20bar%20Lisbon');
  });

  it('merges a group’s taste without one person drowning out the rest', () => {
    const merged = mergeTastes([
      { genres: ['classic rock', 'southern rock', 'blues rock'], topArtists: ['Tom Petty'] },
      { genres: ['mpb', 'samba'], topArtists: ['Seu Jorge'], energy: 'chill' },
      { genres: [] },
    ]);
    expect(merged?.genres.slice(0, 4)).toEqual(['classic rock', 'mpb', 'southern rock', 'samba']);
    expect(merged?.topArtists).toEqual(['Tom Petty', 'Seu Jorge']);
    expect(mergeTastes([{ genres: [] }])).toBeUndefined();
  });

  it('validates taste input', () => {
    const taste = readTaste({ genres: ['Rock', 'Rock', 7, 'x'.repeat(200)], eras: [{ decade: '1970s', share: 2 }], energy: 'LOUD' });
    expect(taste.genres).toEqual(['rock', 'x'.repeat(40)]);
    expect(taste.eras).toEqual([]);
    expect(taste.energy).toBeUndefined();
  });
});

describe('classify', () => {
  it('finds your artist on a festival bill even when the title does not name them', () => {
    expect(classify('Rock in Rio Lisboa', ['Anitta', 'Fleetwood Mac', 'Seu Jorge', 'Muse', 'Ivete Sangalo'], 'Seu Jorge', 'artist')).toBe('festival');
    expect(classify('Seu Jorge: Live in Lisbon', ['Seu Jorge'], 'Seu Jorge', 'artist')).toBe('artist');
    expect(classify('Petty Theft: A Tribute to Tom Petty', [], 'Tom Petty', 'tribute')).toBe('tribute');
    expect(classify('Petty Theft: A Tribute to Tom Petty', [], 'Tom Petty', 'artist')).toBeNull();
    expect(classify('Unrelated Jazz Night', ['Trio X'], 'Tom Petty', 'artist')).toBeNull();
  });
});

describe('fromSeatGeek', () => {
  const raw = {
    id: 99,
    title: 'Shaky Knees Festival',
    type: 'music_festival',
    url: 'https://seatgeek.com/shaky-knees-tickets/99',
    datetime_local: '2027-05-01T12:00:00',
    venue: { name: 'Piedmont Park', city: 'Atlanta', country: 'US', location: { lat: 33.78, lon: -84.37 } },
    performers: [{ name: 'Outkast', image: 'https://seatgeekimages.com/p/1.jpg' }, { name: 'Other' }],
    stats: { lowest_price: 149.5 },
  };

  it('maps coordinates, lineup, festival type, and price', () => {
    expect(fromSeatGeek(raw)).toMatchObject({ id: 'sg:99', lat: 33.78, lon: -84.37, lineup: ['Outkast', 'Other'], festivalType: true, price: 'USD 150+', time: '12:00' });
  });

  it('refuses off-domain links and images', () => {
    expect(fromSeatGeek({ ...raw, url: 'https://evil.example/x' })).toBeNull();
    expect(fromSeatGeek({ ...raw, performers: [{ name: 'Outkast', image: 'https://evil.example/i.jpg' }] })?.image).toBeUndefined();
  });
});

function fakeFetch(routes: [RegExp, unknown][]) {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = String(input);
    const hit = routes.find(([pattern]) => pattern.test(url));
    return new Response(JSON.stringify(hit ? hit[1] : {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
}

const tmEvent = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  url: `https://www.ticketmaster.com/event/${id}`,
  dates: { start: { localDate: '2026-11-07', localTime: '20:00:00' } },
  _embedded: { venues: [{ name: 'Tabernacle', city: { name: 'Atlanta' }, country: { countryCode: 'US' }, location: { latitude: '33.75', longitude: '-84.39' } }] },
  ...extra,
});

describe('searchArtistEvents', () => {
  it('combines both providers, classifies, and drops the same show listed twice', async () => {
    const fetchImpl = fakeFetch([
      [/ticketmaster.*keyword=Outkast\+tribute/, { _embedded: { events: [tmEvent('t1', 'Hey Ya! An Outkast Tribute')] } }],
      [/ticketmaster.*keyword=Outkast/, { _embedded: { events: [tmEvent('a1', 'Outkast Live'), tmEvent('x', 'Random Band')] } }],
      [/seatgeek.*q=Outkast&/, { events: [{ id: 5, title: 'Outkast Live', url: 'https://seatgeek.com/e/5', datetime_local: '2026-11-07T20:00:00', venue: { city: 'Atlanta' }, performers: [{ name: 'Outkast' }] }] }],
    ]);
    const events = await searchArtistEvents({ artists: ['Outkast'] }, { ticketmaster: 'k', seatgeek: 'c' }, fetchImpl);
    expect(events.map((event) => [event.name, event.kind]).sort()).toEqual([
      ['Hey Ya! An Outkast Tribute', 'tribute'],
      ['Outkast Live', 'artist'],
    ]);
    expect(events.find((event) => event.kind === 'artist')).toMatchObject({ lat: 33.75, lon: -84.39 });
  });
});

describe('searchCityScene', () => {
  it('keeps only nights that match the playbook or are tribute acts', async () => {
    const fetchImpl = fakeFetch([
      [/classificationName=Rock/, { _embedded: { events: [tmEvent('r1', 'Southern Rock Night'), tmEvent('r2', 'Poetry Reading')] } }],
      [/keyword=tribute/, { _embedded: { events: [tmEvent('tr', 'ABBA Tribute Show')] } }],
    ]);
    const events = await searchCityScene({ city: 'Atlanta', scenes: ['rock-covers'] }, { ticketmaster: 'k' }, fetchImpl);
    expect(events.map((event) => [event.name, event.kind, event.scene])).toEqual([
      ['Southern Rock Night', 'scene', 'rock-covers'],
      ['ABBA Tribute Show', 'tribute', undefined],
    ]);
  });
});

describe('Jev music judgments', () => {
  it('parses a persona and rejects malformed answers', () => {
    const payload = {
      model: 'jev-1.13.0',
      answers: {
        venue_style: { type: 'choice', choice: 'dive_bar', confidence: 0.29 },
        cover_bands: { type: 'noul', noul: 0.72 },
        festivals: { type: 'noul', noul: 0.67 },
        sing_along: { type: 'noul', noul: 0.68 },
        energy: { type: 'score', score: 2.16 },
      },
    };
    expect(parsePersona(payload)).toMatchObject({ venueStyle: 'dive_bar', coverBands: 0.72, energy: 2.16 });
    expect(parsePersona({ ...payload, answers: { ...payload.answers, venue_style: { type: 'choice', choice: 'yacht' } } })).toBeNull();
    expect(parsePersona(null)).toBeNull();
  });

  it('scores event fit on 0–1 and skips bad answers', async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      const answers = call === 1 ? { fit: { type: 'score', score: 2.4 } } : { fit: { type: 'score', score: 9 } };
      return new Response(JSON.stringify({ model: 'jev-1.13.0', answers }), { status: 200 });
    }) as unknown as typeof fetch;
    const events = [
      { id: 'a', source: 'ticketmaster' as const, kind: 'tribute' as const, name: 'Petty tribute', date: '2026-11-01', url: 'https://www.ticketmaster.com/e/a' },
      { id: 'b', source: 'ticketmaster' as const, kind: 'scene' as const, name: 'Other', date: '2026-11-01', url: 'https://www.ticketmaster.com/e/b' },
    ];
    const fit = await jevEventFit({ topArtists: ['Tom Petty'], genres: ['classic rock'], eras: ['1970s'] }, events, fetchImpl);
    expect([...fit.entries()]).toEqual([['a', 0.8]]);
    vi.unstubAllEnvs();
  });
});
