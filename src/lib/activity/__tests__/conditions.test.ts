import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity } from '../activities';

vi.mock('server-only', () => ({}));

import {
  compassWord,
  explainAurora,
  explainBeach,
  explainSnow,
  explainSurf,
  FETCHERS,
  fromDirection,
  periodQuality,
  uvAdvice,
  waveHeight,
} from '../conditions';
import { cloudTonight, maxKpNext24h, parseKpRows } from '../conditions/aurora';
import { getJSON, inflightCount, openMeteoUrl, UpstreamError } from '../conditions/http';

const FT = 1 / 3.281;

/** The rejection of a promise that must fail. */
const failure = (p: Promise<unknown>) =>
  p.then(
    () => { throw new Error('expected a failure'); },
    (e: unknown) => e as UpstreamError,
  ); // metres in a foot, as the fetcher converts

function activity(over: Partial<Activity> = {}): Activity {
  return {
    id: 'test-spot', name: 'Test Spot', place: 'Vail', country: 'United States', countryCode: 'US', region: 'Americas',
    lat: 39.64, lng: -106.37, category: 'ski', kind: 'place', bestMonths: [12, 1, 2, 3], peakMonths: [1, 2],
    summary: 'A test spot.', tags: [], heat: null, conditions: 'snow', sources: [], ...over,
  };
}

describe('direction words', () => {
  it('names the eight compass points as words, never degrees', () => {
    expect(compassWord(158)).toBe('South');
    expect(compassWord(0)).toBe('North');
    expect(compassWord(359)).toBe('North');
    expect(compassWord(315)).toBe('Northwest');
    expect(compassWord(-45)).toBe('Northwest');
    expect(compassWord(112)).toBe('East');
    expect(compassWord(113)).toBe('Southeast');
    expect(fromDirection(158)).toBe('From the south');
    expect(fromDirection(300)).toBe('From the northwest');
  });
});

describe('explainSurf', () => {
  it('bands size in feet and period quality', () => {
    expect(explainSurf(7 * FT, 8, 'imperial')).toBe('7 ft at 8 s: big, for experienced surfers.');
    expect(explainSurf(3 * FT, 11, 'imperial')).toBe('3 ft at 11 s: fun for most surfers.');
    expect(explainSurf(4 * FT, 14, 'imperial')).toBe('4 ft at 14 s: long, clean swell, fun for most surfers.');
    expect(explainSurf(6 * FT, 6, 'imperial')).toBe('6 ft at 6 s: choppy wind swell, big, for experienced surfers.');
    expect(explainSurf(2 * FT, 9, 'imperial')).toBe('2 ft at 9 s: small, good for beginners.');
    expect(explainSurf(12 * FT, 16, 'imperial')).toBe('12 ft at 16 s: long, clean swell, huge, experts only.');
    expect(explainSurf(1 * FT, 12, 'imperial')).toBe('1 ft: flat, better for a swim.');
    expect(explainSurf(0.5 * FT, 5, 'imperial')).toBe('0.5 ft: flat, better for a swim.');
  });

  it('bands size in metres', () => {
    expect(explainSurf(2.1, 8, 'metric')).toBe('2.1 m at 8 s: big, for experienced surfers.');
    expect(explainSurf(1, 11, 'metric')).toBe('1 m at 11 s: fun for most surfers.');
    expect(explainSurf(0.7, 13, 'metric')).toBe('0.7 m at 13 s: long, clean swell, small, good for beginners.');
    expect(explainSurf(3.2, 15, 'metric')).toBe('3.2 m at 15 s: long, clean swell, huge, experts only.');
    expect(explainSurf(0.3, 9, 'metric')).toBe('0.3 m: flat, better for a swim.');
  });

  it('handles missing period, zero height and missing height', () => {
    expect(explainSurf(4 * FT, null, 'imperial')).toBe('4 ft: fun for most surfers.');
    expect(explainSurf(0, 10, 'imperial')).toBe('Flat, better for a swim.');
    expect(explainSurf(0.01, 10, 'metric')).toBe('Flat, better for a swim.');
    expect(explainSurf(null, 10, 'imperial')).toBeUndefined();
  });

  it('classifies period at the band edges', () => {
    expect(periodQuality(7.9)).toBe('choppy');
    expect(periodQuality(8)).toBe('okay');
    expect(periodQuality(11)).toBe('okay');
    expect(periodQuality(12)).toBe('clean');
  });

  it('shows wave height the same way the stat does', () => {
    expect(waveHeight(1, 'imperial')).toEqual({ value: 3, unit: 'ft' });
    expect(waveHeight(0.2, 'imperial')).toEqual({ value: 0.7, unit: 'ft' });
    expect(waveHeight(1.26, 'metric')).toEqual({ value: 1.3, unit: 'm' });
  });
});

describe('explainSnow', () => {
  it('bands new snow and base in inches', () => {
    expect(explainSnow(14, 40, 'imperial')).toBe('14 in of new snow this week: powder days.');
    expect(explainSnow(12, 40, 'imperial')).toBe('12 in of new snow this week: powder days.');
    expect(explainSnow(6, 40, 'imperial')).toBe('6 in of new snow this week: fresh snow on a 40 in base.');
    expect(explainSnow(2, 40, 'imperial')).toBe('A little new snow this week (2 in); mostly groomed runs on a 40 in base.');
    expect(explainSnow(0, 40, 'imperial')).toBe('No new snow this week; groomed runs on a 40 in base.');
    expect(explainSnow(0.2, 40, 'imperial')).toBe('No new snow this week; groomed runs on a 40 in base.');
    expect(explainSnow(20, 8, 'imperial')).toBe('Thin cover: check which lifts are open.');
    expect(explainSnow(0, 0, 'imperial')).toBe('Thin cover: check which lifts are open.');
  });

  it('bands new snow and base in centimetres', () => {
    expect(explainSnow(35, 120, 'metric')).toBe('35 cm of new snow this week: powder days.');
    expect(explainSnow(12, 120, 'metric')).toBe('12 cm of new snow this week: fresh snow on a 120 cm base.');
    expect(explainSnow(3, 120, 'metric')).toBe('A little new snow this week (3 cm); mostly groomed runs on a 120 cm base.');
    expect(explainSnow(0, 120, 'metric')).toBe('No new snow this week; groomed runs on a 120 cm base.');
    expect(explainSnow(10, 20, 'metric')).toBe('Thin cover: check which lifts are open.');
  });

  it('copes with unknown depth or snowfall', () => {
    expect(explainSnow(6, null, 'imperial')).toBe('6 in of new snow this week: fresh snow on the slopes.');
    expect(explainSnow(0, null, 'imperial')).toBe('No new snow this week; groomed runs.');
    expect(explainSnow(null, 40, 'imperial')).toBe('Groomed runs on a 40 in base.');
    expect(explainSnow(null, null, 'imperial')).toBeUndefined();
  });
});

describe('explainAurora', () => {
  it('reads Kp and cloud together', () => {
    expect(explainAurora(5, 20)).toBe('Kp 5 and clear skies tonight: a good chance to see it.');
    expect(explainAurora(2, 0)).toBe('Kp 2: faint, usually only on camera.');
    expect(explainAurora(5, 85)).toBe('Kp 5 but cloudy tonight: views unlikely.');
    expect(explainAurora(3.67, 30)).toBe('Kp 3.7 and clear skies tonight: a fair chance on a dark night.');
    expect(explainAurora(4, 55)).toBe('Kp 4 and some cloud tonight: watch for gaps.');
    expect(explainAurora(6, null)).toBe('Kp 6: a good chance to see it if the sky is clear.');
    expect(explainAurora(0, 10)).toBe('Kp 0: faint, usually only on camera.');
  });

  it('band edges: Kp 3 visible, 5 strong; 40% clear, 70% cloudy', () => {
    expect(explainAurora(2.9, 10)).toMatch(/faint/);
    expect(explainAurora(3, 10)).toMatch(/fair chance/);
    expect(explainAurora(5, 40)).toMatch(/clear skies/);
    expect(explainAurora(5, 41)).toMatch(/some cloud/);
    expect(explainAurora(5, 70)).toMatch(/views unlikely/);
    expect(explainAurora(null, 10)).toBeUndefined();
  });
});

describe('explainBeach', () => {
  it('reads air, water and UV in Fahrenheit', () => {
    expect(explainBeach(81, 79, 9, 'imperial')).toBe('81°F air and 79°F water: warm swimming. UV 9: shade by midday.');
    expect(explainBeach(80, 74, 6, 'imperial')).toBe('80°F air and 74°F water: pleasant swimming. UV 6: sunscreen and a hat.');
    expect(explainBeach(72, 66, 4, 'imperial')).toBe('72°F air and 66°F water: cool swimming. UV 4: wear sunscreen.');
    expect(explainBeach(68, 58, 2, 'imperial')).toBe('68°F air and 58°F water: cold water, a wetsuit helps.');
  });

  it('reads air, water and UV in Celsius', () => {
    expect(explainBeach(29, 27, 10, 'metric')).toBe('29°C air and 27°C water: warm swimming. UV 10: shade by midday.');
    expect(explainBeach(26, 23, null, 'metric')).toBe('26°C air and 23°C water: pleasant swimming.');
    expect(explainBeach(22, 19, 3, 'metric')).toBe('22°C air and 19°C water: cool swimming. UV 3: wear sunscreen.');
    expect(explainBeach(18, 14, 1, 'metric')).toBe('18°C air and 14°C water: cold water, a wetsuit helps.');
  });

  it('falls back to air alone, water alone or UV alone', () => {
    expect(explainBeach(84, null, null, 'imperial')).toBe('84°F air: beach weather.');
    expect(explainBeach(19, null, null, 'metric')).toBe('19°C air: mild, better for a walk than a swim.');
    expect(explainBeach(55, null, 8, 'imperial')).toBe('55°F air: cool for the beach. UV 8: shade by midday.');
    expect(explainBeach(null, 25, null, 'metric')).toBe('25°C water: pleasant swimming.');
    expect(explainBeach(null, null, 7, 'metric')).toBe('UV 7: sunscreen and a hat.');
    expect(explainBeach(null, null, 1, 'metric')).toBeUndefined();
    expect(uvAdvice(0)).toBeUndefined();
  });
});

describe('aurora parsing', () => {
  const now = new Date('2026-09-28T18:00:00Z');
  it('reads object and legacy array Kp rows and takes the next-24 h max', () => {
    const rows = parseKpRows([
      { time_tag: '2026-09-28T12:00:00', kp: 6, observed: 'observed' }, // 6 h ago: out of window
      { time_tag: '2026-09-28T18:00:00', kp: 3.33, observed: 'predicted' },
      { time_tag: '2026-09-29T03:00:00', kp: 4.67, observed: 'predicted' },
      { time_tag: '2026-09-30T03:00:00', kp: 8, observed: 'predicted' }, // too far ahead
    ]);
    expect(maxKpNext24h(rows, now)).toBe(4.67);
    const legacy = parseKpRows([['time_tag', 'kp', 'observed'], ['2026-09-28 21:00:00.000', '5.00', 'predicted']]);
    expect(maxKpNext24h(legacy, now)).toBe(5);
    expect(parseKpRows({ nope: true })).toEqual([]);
  });

  it('averages cloud cover from 21:00 to 03:00 local', () => {
    const time = ['2026-09-28T19:00', '2026-09-28T20:00', '2026-09-28T21:00', '2026-09-28T22:00', '2026-09-28T23:00',
      '2026-09-29T00:00', '2026-09-29T01:00', '2026-09-29T02:00', '2026-09-29T03:00', '2026-09-29T04:00'];
    const cloud = [100, 100, 10, 20, 30, 40, null, 20, 20, 100];
    // Local UTC+1: 19:00 local now.
    expect(cloudTonight({ time, cloud_cover: cloud }, 3600, now)).toBeCloseTo(140 / 6);
    expect(cloudTonight(undefined, 0, now)).toBeNull();
  });
});

describe('fetchers', () => {
  const fetchMock = vi.fn();
  const NOW = new Date('2026-09-28T18:00:00Z');
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('OPEN_METEO_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchMock.mockReset();
  });

  it('uses the free hosts without a key and the customer hosts with one, never leaking it', async () => {
    fetchMock.mockImplementation(async () => json({ current: { wave_height: 1.2, wave_period: 12, wave_direction: 158 } }));
    await FETCHERS.marine(activity({ conditions: 'marine' }), { units: 'imperial', now: NOW });
    const free = new URL(String(fetchMock.mock.calls[0][0]));
    expect(free.host).toBe('marine-api.open-meteo.com');
    expect(free.searchParams.has('apikey')).toBe(false);

    vi.stubEnv('OPEN_METEO_API_KEY', 'sekret-key');
    fetchMock.mockClear();
    const out = await FETCHERS.marine(activity({ conditions: 'marine' }), { units: 'imperial', now: NOW });
    const paid = new URL(String(fetchMock.mock.calls[0][0]));
    expect(paid.host).toBe('customer-marine-api.open-meteo.com');
    expect(paid.searchParams.get('apikey')).toBe('sekret-key');
    expect(JSON.stringify(out)).not.toContain('sekret');
    expect(openMeteoUrl('forecast', { latitude: 1 })).not.toContain('sekret');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.cache).toBe('no-store');
  });

  it('marine: words for direction, an explanation, ISO time', async () => {
    fetchMock.mockResolvedValue(json({ current: { wave_height: 1.2, wave_period: 12, wave_direction: 158 } }));
    const out = await FETCHERS.marine(activity({ conditions: 'marine' }), { units: 'imperial', now: NOW });
    expect(out).toEqual({
      kind: 'marine',
      stats: [
        { label: 'Waves', value: '4', unit: 'ft' },
        { label: 'Period', value: '12', unit: 's' },
        { label: 'From', value: 'South' },
      ],
      explain: '4 ft at 12 s: long, clean swell, fun for most surfers.',
      good: '4 ft waves at 12 s',
      basis: 'Modeled',
      sources: [{ name: 'Open-Meteo Marine', url: 'https://open-meteo.com/en/docs/marine-weather-api' }],
      updatedAt: '2026-09-28T18:00:00.000Z',
    });
    expect(JSON.stringify(out)).not.toMatch(/°/);
  });

  it('marine: inland cells and zero waves are dropped, not shown as zero', async () => {
    fetchMock.mockResolvedValueOnce(json({ current: { wave_height: null, wave_period: null } }));
    expect(await FETCHERS.marine(activity(), { units: 'metric', now: NOW })).toBeNull();
    fetchMock.mockResolvedValueOnce(json({ current: { wave_height: 0, wave_period: 0, wave_direction: 90 } }));
    const out = await FETCHERS.marine(activity(), { units: 'metric', now: NOW });
    expect(out?.stats).toEqual([{ label: 'From', value: 'East' }]);
    expect(out?.explain).toBe('Flat, better for a swim.');
  });

  it('snow: past week snowfall drives the explanation and the good line', async () => {
    fetchMock.mockResolvedValue(json({
      current: { time: '2026-12-10T09:00', temperature_2m: 21, snow_depth: 3.5 },
      daily: {
        time: ['2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07', '2026-12-08', '2026-12-09',
          '2026-12-10', '2026-12-11', '2026-12-12', '2026-12-13', '2026-12-14', '2026-12-15', '2026-12-16'],
        snowfall_sum: [2, 4, 0, 0, 5, 3, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    }));
    const out = await FETCHERS.snow(activity({ elevationFt: 11570 }), { units: 'imperial', now: NOW });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('elevation')).toBe(String(Math.round(11570 * 0.3048 * 0.85)));
    expect(url.searchParams.get('precipitation_unit')).toBe('inch');
    expect(out?.stats).toEqual([
      { label: 'Snow depth', value: '42', unit: 'in' },
      { label: 'Temperature', value: '21', unit: '°F' },
    ]);
    expect(out?.note).toBe('No snow in the next 7 days.');
    expect(out?.explain).toBe('14 in of new snow this week: powder days.');
    expect(out?.good).toBe('14 in of new snow this week');
  });

  it('beach: one failed upstream still answers, and says so; both failed throws', async () => {
    fetchMock.mockImplementation(async (u: URL) =>
      String(u).includes('marine') ? json({}, 502) : json({ current: { temperature_2m: 81 }, daily: { uv_index_max: [0] } }));
    const onUpstreamError = vi.fn();
    const out = await FETCHERS.beach(activity({ conditions: 'beach' }), { units: 'imperial', now: NOW, onUpstreamError });
    expect(onUpstreamError).toHaveBeenCalledTimes(1);
    expect(out?.stats).toEqual([{ label: 'Air', value: '81', unit: '°F' }]); // UV 0 is dropped
    expect(out?.explain).toBe('81°F air: beach weather.');
    expect(out?.sources.map((s) => s.name)).toEqual(['Open-Meteo']);

    fetchMock.mockImplementation(async () => json({}, 500));
    await expect(FETCHERS.beach(activity(), { units: 'imperial', now: NOW })).rejects.toThrow();
  });

  it('beach: water temperature converts from Celsius', async () => {
    fetchMock.mockImplementation(async (u: URL) =>
      String(u).includes('marine')
        ? json({ current: { sea_surface_temperature: 26 } })
        : json({ current: { temperature_2m: 81 }, daily: { uv_index_max: [9.2] } }));
    const out = await FETCHERS.beach(activity(), { units: 'imperial', now: NOW });
    expect(out?.explain).toBe('81°F air and 79°F water: warm swimming. UV 9: shade by midday.');
    expect(out?.good).toBe('81°F air, 79°F water');
  });

  it('aurora: Kp plus cloud, with a partial answer when one source fails', async () => {
    fetchMock.mockImplementation(async (u: URL) =>
      String(u).includes('swpc')
        ? json([{ time_tag: '2026-09-28T21:00:00', kp: 5, observed: 'predicted' }])
        : json({ utc_offset_seconds: 0, hourly: { time: ['2026-09-28T21:00', '2026-09-28T22:00'], cloud_cover: [10, 20] } }));
    const out = await FETCHERS.aurora(activity({ conditions: 'aurora' }), { units: 'metric', now: NOW });
    expect(out?.explain).toBe('Kp 5 and clear skies tonight: a good chance to see it.');
    expect(out?.good).toBe('Kp 5 with clear skies tonight');
    expect(out?.basis).toBe('Forecast');

    const onUpstreamError = vi.fn();
    fetchMock.mockImplementation(async (u: URL) =>
      String(u).includes('swpc') ? json([{ time_tag: '2026-09-28T21:00:00', kp: 2 }]) : json({}, 503));
    const partial = await FETCHERS.aurora(activity(), { units: 'metric', now: NOW, onUpstreamError });
    expect(onUpstreamError).toHaveBeenCalled();
    expect(partial?.stats).toEqual([{ label: 'Kp next 24 h', value: '2' }]);
    expect(partial?.good).toBeNull();
  });

  it('weather: a single failed upstream throws an error that names only the host', async () => {
    vi.stubEnv('OPEN_METEO_API_KEY', 'sekret-key');
    fetchMock.mockResolvedValue(json({ error: true }, 429));
    const err = await failure(FETCHERS.weather(activity({ conditions: null }), { units: 'metric', now: NOW }));
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.message).toBe('customer-api.open-meteo.com: HTTP 429');
    expect(err.message).not.toContain('sekret');
  });

  it('event: built from the listing with no network', async () => {
    const ev = activity({
      kind: 'event', conditions: 'event', place: 'Helsinki',
      eventDates: { start: '2026-10-10', end: '2026-10-12', status: 'estimated', sourceUrl: 'https://www.flowfestival.com/en/' },
    });
    const out = await FETCHERS.event(ev, { units: 'imperial', now: new Date(2026, 8, 28, 12) });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out?.stats).toEqual([
      { label: 'Starts in', value: '12', unit: 'days' },
      { label: 'Venue', value: 'Helsinki' },
      { label: 'Details', value: 'Official site', href: 'https://www.flowfestival.com/en/' },
    ]);
    expect(out?.note).toMatch(/estimated/);
    expect(out?.sources).toEqual([{ name: 'flowfestival.com', url: 'https://www.flowfestival.com/en/' }]);
    // A non-https source is not linked.
    const unsafe = await FETCHERS.event(
      { ...ev, eventDates: { ...ev.eventDates!, sourceUrl: 'javascript:alert(1)' } },
      { units: 'imperial', now: new Date(2026, 8, 28, 12) },
    );
    expect(unsafe?.stats.some((s) => s.href)).toBe(false);
    expect(unsafe?.sources).toEqual([]);
  });

  it('shares one upstream call between identical concurrent requests', async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { release = r; }));
    const url = openMeteoUrl('forecast', { latitude: 1, longitude: 2 });
    const a = getJSON(url), b = getJSON(url);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(inflightCount()).toBe(1);
    release(json({ ok: 1 }));
    expect(await a).toEqual({ ok: 1 });
    expect(await b).toEqual({ ok: 1 });
    expect(inflightCount()).toBe(0);
  });

  it('turns a timeout into an upstream error', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
    const err = await failure(getJSON(openMeteoUrl('forecast', { latitude: 3 })));
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.reason).toBe('timeout');
  });
});
