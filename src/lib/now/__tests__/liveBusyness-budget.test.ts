import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { takeShared, takeSharedNamed } = vi.hoisted(() => ({ takeShared: vi.fn(async () => true), takeSharedNamed: vi.fn(async () => true) }));
vi.mock('@/lib/designer/server/sharedBudget', () => ({ takeShared, takeSharedNamed }));

import { liveBusyness, liveToken, memberPool, validLiveToken } from '../liveBusyness';

const ok = { status: 'OK', analysis: { venue_live_busyness: 70, venue_live_busyness_available: true, venue_forecasted_busyness: 40, venue_forecast_busyness_available: true, venue_live_forecasted_delta: 30 } };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'secret-key-for-tests');
  fetchMock = vi.fn(async () => new Response(JSON.stringify(ok), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  takeShared.mockClear();
  takeSharedNamed.mockClear();
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
  takeShared.mockImplementationOnce(async () => false);
  await expect(liveBusyness('ven_site_cap', 'member-a')).rejects.toThrow(/today’s limit/);
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
