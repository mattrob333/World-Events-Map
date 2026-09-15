import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data';
import { registerFakeSource } from '@/lib/data/__tests__/fakeSource';

vi.mock('server-only', () => ({}));

const ids = EVENTS.slice(0, 2).map((event) => event.id);
const request = (query: string) => new Request(`http://localhost/api/signals?${query}`);

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function setup() {
  const fake = await registerFakeSource();
  const server = await import('@/lib/data/server');
  const spies = [
    vi.spyOn(server, 'refreshSignals'),
    vi.spyOn(server, 'getSignalPatches'),
    vi.spyOn(server, 'sweepAllSignals'),
  ];
  const { GET } = await import('../signals/route');
  return { fake, server, spies, GET };
}

describe('public signals route is read-only', () => {
  it('ignores force=1 on a cold cache and reports baseline patches and unsynced health', async () => {
    const { fake, server, spies, GET } = await setup();
    const fetch = vi.spyOn(globalThis, 'fetch');
    const response = await GET(request(`ids=${ids.join(',')}&force=1`));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      signals: {},
      unknownIds: [],
      sources: server.getSourceHealth(),
    });
    expect(server.getSourceHealth()).toContainEqual(expect.objectContaining({
      id: 'fake', status: 'stale', detail: 'Configured, awaiting first sync',
    }));
    expect(server.signalCacheAgeMs()).toBeNull();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fake.fetchSignals).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reads only requested cached patches and preserves unknownIds without refreshing', async () => {
    const { fake, server, spies, GET } = await setup();
    await server.refreshSignals([...ids, EVENTS[2].id]);
    for (const spy of spies) spy.mockClear();
    fake.fetchSignals.mockClear();

    const response = await GET(request(`ids=${ids.join(',')},missing,${ids[0]}&force=1`));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      signals: { [ids[0]]: { searchInterest: 73 }, [ids[1]]: { searchInterest: 73 } },
      unknownIds: ['missing'],
      sources: server.getSourceHealth(),
    });
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it('returns to baseline at TTL expiry without fetching vendors', async () => {
    vi.useFakeTimers();
    const { fake, server, spies, GET } = await setup();
    await server.refreshSignals(ids);
    for (const spy of spies) spy.mockClear();
    fake.fetchSignals.mockClear();
    vi.advanceTimersByTime(server.SIGNAL_TTL_MS);

    const response = await GET(request(`ids=${ids.join(',')}&force=1`));
    expect(response.status).toBe(200);
    expect((await response.json()).signals).toEqual({});
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it('serves a cold read without waiting for an authorized refresh in flight', async () => {
    const { fake, server, spies, GET } = await setup();
    let release!: () => void;
    fake.fetchSignals.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve(new Map([[ids[0], { searchInterest: 73 }]]));
    }));
    const refresh = server.refreshSignals(ids);
    await Promise.resolve();
    for (const spy of spies) spy.mockClear();

    try {
      const response = await GET(request(`ids=${ids.join(',')}&force=1`));
      expect((await response.json()).signals).toEqual({});
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    } finally {
      release();
      await refresh;
    }
  });

  it('preserves empty requests and the 60-id response cap', async () => {
    const { fake, GET } = await setup();
    const empty = await GET(request('force=1'));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ signals: {}, unknownIds: [] });

    const unknown = Array.from({ length: 61 }, (_, i) => `missing-${i}`);
    const capped = await GET(request(`ids=${unknown.join(',')}&force=1`));
    expect(capped.status).toBe(200);
    expect(await capped.json()).toMatchObject({ signals: {}, unknownIds: unknown.slice(0, 60) });
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });
});
