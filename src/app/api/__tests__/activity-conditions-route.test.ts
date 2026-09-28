import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITIES } from '@/lib/activity/data';

vi.mock('server-only', () => ({}));

import { GET } from '../activity-conditions/route';
import { resetActivityConditionsLimitsForTests } from '@/lib/activity/conditions/limits';
import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';

const fetchMock = vi.fn();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const get = (qs: string) => GET(new Request(`http://localhost/api/activity-conditions?${qs}`));
const firstOf = (kind: string | null) => ACTIVITIES.find((a) => a.conditions === kind)!;

const MODEL_CACHE = 'public, max-age=0, s-maxage=21600, stale-while-revalidate=3600';
const FAILED_CACHE = 'public, max-age=0, s-maxage=300';

beforeEach(() => {
  resetNowRateLimitsForTests();
  resetActivityConditionsLimitsForTests();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('OPEN_METEO_API_KEY', '');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

describe('GET /api/activity-conditions', () => {
  it('rejects malformed ids, bad units and extra parameters, and 404s unknown ids', async () => {
    for (const qs of ['', 'id=', 'id=Bad%20Id', 'id=../etc', `id=${'a'.repeat(200)}`, 'id=a&id=b']) {
      const r = await get(qs);
      expect(r.status, qs).toBe(400);
      expect(r.headers.get('Cache-Control')).toBe('no-store');
    }
    const spot = firstOf('snow').id;
    expect((await get(`id=${spot}&units=kelvin`)).status).toBe(400);
    expect((await get(`id=${spot}&units=metric&units=imperial`)).status).toBe(400);
    expect((await get(`id=${spot}&bust=123`)).status).toBe(400);
    const missing = await get('id=no-such-activity');
    expect(missing.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serves snow conditions from the upstream with a six-hour edge cache', async () => {
    // The fixture is a December morning; in September a ski area is off season.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 11, 10, 9));
    fetchMock.mockResolvedValue(json({
      current: { time: '2026-12-10T09:00', temperature_2m: -4, snow_depth: 0.9 },
      daily: { time: ['2026-12-09', '2026-12-10'], snowfall_sum: [10, 2] },
    }));
    const r = await get(`id=${firstOf('snow').id}&units=metric`);
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe(MODEL_CACHE);
    const { conditions } = await r.json();
    expect(conditions.kind).toBe('snow');
    expect(conditions.stats[0]).toEqual({ label: 'Snow depth', value: '90', unit: 'cm' });
    expect(conditions.explain).toBe('10 cm of new snow this week: fresh snow on a 90 cm base.');
    expect(typeof conditions.updatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(conditions.updatedAt))).toBe(false);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
  });

  it('defaults to imperial units', async () => {
    fetchMock.mockResolvedValue(json({ current: { temperature_2m: 70 }, daily: {} }));
    const r = await get(`id=${firstOf(null).id}`);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect((await r.json()).conditions.stats).toEqual([{ label: 'Now', value: '70', unit: '°F' }]);
  });

  it('uses a fifteen-minute cache for aurora', async () => {
    fetchMock.mockImplementation(async (u: URL) =>
      String(u).includes('swpc') ? json([]) : json({ utc_offset_seconds: 0, hourly: { time: ['2026-09-28T22:00'], cloud_cover: [30] } }));
    const r = await get(`id=${firstOf('aurora').id}`);
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=900, stale-while-revalidate=300');
  });

  it('computes events without the network and caches them for an hour', async () => {
    const ev = ACTIVITIES.find((a) => a.conditions === 'event' && a.eventDates)!;
    const r = await get(`id=${ev.id}`);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=0, s-maxage=3600, stale-while-revalidate=600');
    expect((await r.json()).conditions.kind).toBe('event');
  });

  it('answers null on a short cache when the upstream fails, never an invented value', async () => {
    vi.stubEnv('OPEN_METEO_API_KEY', 'sekret-key');
    fetchMock.mockResolvedValue(json({ error: true }, 500));
    const r = await get(`id=${firstOf('marine').id}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('Cache-Control')).toBe(FAILED_CACHE);
    expect(await r.json()).toEqual({ conditions: null });
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logged).not.toContain('sekret');
    expect(logged).toContain('customer-marine-api.open-meteo.com');

    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    const timedOut = await get(`id=${firstOf(null).id}`);
    expect(await timedOut.json()).toEqual({ conditions: null });
    expect(timedOut.headers.get('Cache-Control')).toBe(FAILED_CACHE);
  });

  it('keeps a partial answer on the short cache', async () => {
    fetchMock.mockImplementation(async (u: URL) =>
      String(u).includes('marine') ? json({}, 503) : json({ current: { temperature_2m: 80 }, daily: { uv_index_max: [7] } }));
    const r = await get(`id=${firstOf('beach').id}`);
    expect(r.headers.get('Cache-Control')).toBe(FAILED_CACHE);
    const { conditions } = await r.json();
    expect(conditions.stats.map((s: { label: string }) => s.label)).toEqual(['Air', 'UV index']);
  });

  it('answers null with the normal cache when the model has no data for the spot', async () => {
    fetchMock.mockResolvedValue(json({ current: { wave_height: null, wave_period: null } }));
    const r = await get(`id=${firstOf('marine').id}`);
    expect(await r.json()).toEqual({ conditions: null });
    expect(r.headers.get('Cache-Control')).toBe(MODEL_CACHE);
  });

  it('shares one upstream call between identical concurrent requests', async () => {
    let release!: (r: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((r) => { release = r; }));
    const id = firstOf('marine').id;
    const both = Promise.all([get(`id=${id}`), get(`id=${id}`)]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release(json({ current: { wave_height: 1, wave_period: 10, wave_direction: 270 } }));
    const bodies = await Promise.all((await both).map((r) => r.json()));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodies[0].conditions.stats).toEqual(bodies[1].conditions.stats);
    expect(bodies[0].conditions.stats[2]).toEqual({ label: 'From', value: 'West' });
  });

  it('limits upstream-bound requests per client, with an uncached 429', async () => {
    fetchMock.mockImplementation(async () => json({ current: { time: '2026-12-10T09:00', temperature_2m: 1 }, daily: { time: [], snowfall_sum: [] } }));
    const spot = firstOf('snow').id;
    for (let i = 0; i < 60; i++) expect((await get(`id=${spot}`)).status).not.toBe(429);
    const r = await get(`id=${spot}`);
    expect(r.status).toBe(429);
    expect(r.headers.get('Cache-Control')).toBe('no-store');
    expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(0);
  });
});
