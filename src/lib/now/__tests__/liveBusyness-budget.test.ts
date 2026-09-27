import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { takeShared, takeSharedNamed, refundSharedNamed } = vi.hoisted(() => ({ takeShared: vi.fn(async () => true), takeSharedNamed: vi.fn(async () => true), refundSharedNamed: vi.fn(async () => undefined) }));
vi.mock('@/lib/designer/server/sharedBudget', () => ({ takeShared, takeSharedNamed, refundSharedNamed }));

import { liveBusyness, liveToken, memberPool, placeToken, validLiveToken, validPlaceToken } from '../liveBusyness';

const ok = { status: 'OK', analysis: { venue_live_busyness: 70, venue_live_busyness_available: true, venue_forecasted_busyness: 40, venue_forecast_busyness_available: true, venue_live_forecasted_delta: 30 } };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'secret-key-for-tests');
  fetchMock = vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  takeShared.mockClear();
  takeSharedNamed.mockClear();
  refundSharedNamed.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('spends a credit once per place, then serves the cache', async () => {
  const first = await liveBusyness('ven_cached1', 'member-a');
  const again = await liveBusyness('ven_cached1', 'member-a');
  expect(first?.live).toBe(70);
  expect(again).toEqual(first);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(takeShared).toHaveBeenCalledTimes(1);
  expect(takeSharedNamed).toHaveBeenCalledTimes(1);
});

it('remembers a failure so a broken place doesn’t cost a credit on every tap', async () => {
  fetchMock.mockImplementation(async () => new Response('nope', { status: 500 }));
  expect(await liveBusyness('ven_failing', 'member-a')).toBeNull();
  expect(await liveBusyness('ven_failing', 'member-a')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('stops at the member’s share, and at the site cap, before calling BestTime', async () => {
  takeSharedNamed.mockImplementationOnce(async () => false);
  await expect(liveBusyness('ven_member_cap', 'member-a')).rejects.toThrow(/today’s live checks/);
  expect(refundSharedNamed).not.toHaveBeenCalled();
  takeShared.mockImplementationOnce(async () => false);
  await expect(liveBusyness('ven_site_cap', 'member-a')).rejects.toThrow(/today’s limit/);
  // The site said no, so the member's own share is given back.
  expect(refundSharedNamed).toHaveBeenCalledTimes(1);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('signs places for today and yesterday only, and names member pools in letters', () => {
  const now = Date.parse('2026-09-26T23:00:00Z');
  const token = liveToken('ven_abc123', now);
  expect(validLiveToken('ven_abc123', token, now)).toBe(true);
  expect(validLiveToken('ven_abc123', token, now + 24 * 3600 * 1000)).toBe(true);
  expect(validLiveToken('ven_abc123', token, now + 2 * 24 * 3600 * 1000)).toBe(false);
  expect(validLiveToken('ven_other1', token, now)).toBe(false);
  expect(validLiveToken('ven_abc123', 'x'.repeat(22), now)).toBe(false);
  const pool = memberPool('00000000-0000-0000-0000-00000000000a');
  expect(pool).toMatch(/^[a-zA-Z]{1,40}$/);
  expect(memberPool('someone-else')).not.toBe(pool);
});

it('shares one live call among taps on the same place at once, charged once', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  fetchMock.mockImplementation(async () => { await gate; return new Response(JSON.stringify(ok), { status: 200 }); });
  const both = Promise.all([liveBusyness('ven_together', 'member-a'), liveBusyness('ven_together', 'member-b')]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  const [a, b] = await both;
  expect(a?.live).toBe(70);
  expect(b).toEqual(a);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(takeSharedNamed).toHaveBeenCalledTimes(1);
  expect(takeShared).toHaveBeenCalledTimes(1);
});

it('one member out of checks doesn’t fail another member’s tap at the same moment', async () => {
  takeSharedNamed.mockImplementationOnce(async () => false);
  const [spent, served] = await Promise.allSettled([liveBusyness('ven_shared_tap', 'member-spent'), liveBusyness('ven_shared_tap', 'member-fresh')]);
  expect(spent.status).toBe('rejected');
  expect(served.status === 'fulfilled' && served.value?.live).toBe(70);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(takeSharedNamed).toHaveBeenCalledTimes(2);
});

it('the site at its cap is everyone’s answer, and nothing is remembered', async () => {
  takeShared.mockImplementationOnce(async () => false);
  const [a, b] = await Promise.allSettled([liveBusyness('ven_site_full', 'member-a'), liveBusyness('ven_site_full', 'member-b')]);
  expect(a.status).toBe('rejected');
  expect(b.status).toBe('rejected');
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await liveBusyness('ven_site_full', 'member-a'))?.live).toBe(70);
});

describe('tokens', () => {
  const now = Date.parse('2026-09-26T23:00:00Z');
  const place = { id: 'ven_abc123', name: 'Proof', address: '1 Main St', lat: 41.2565, lng: -95.9345 };

  it('use their own secret when set, and still work from the BestTime key until then', () => {
    const fallback = liveToken('ven_abc123', now);
    vi.stubEnv('NOW_TOKEN_SECRET', 'a-dedicated-secret-that-is-long-enough-000');
    const own = liveToken('ven_abc123', now);
    expect(own).not.toBe(fallback);
    expect(validLiveToken('ven_abc123', own, now)).toBe(true);
    expect(validLiveToken('ven_abc123', fallback, now)).toBe(false);
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
    expect(validLiveToken('ven_abc123', own, now)).toBe(true);
    vi.stubEnv('NOW_TOKEN_SECRET', '');
    expect(validLiveToken('ven_abc123', own, now)).toBe(false);
  });

  it('a live token never passes as a place token', () => {
    const live = liveToken('ven_abc123', now);
    expect(validPlaceToken(place, placeToken(place, now), now)).toBe(true);
    expect(validPlaceToken(place, live, now)).toBe(false);
    expect(validLiveToken('ven_abc123', placeToken(place, now), now)).toBe(false);
  });

  it('fields can’t be shifted from one into the next', () => {
    const token = placeToken({ ...place, name: 'A|B', address: 'C' }, now);
    expect(validPlaceToken({ ...place, name: 'A', address: 'B|C' }, token, now)).toBe(false);
    expect(validPlaceToken({ ...place, name: 'A|B', address: 'C' }, token, now)).toBe(true);
  });
});
