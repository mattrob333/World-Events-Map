import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data';
import { registerFakeSource } from './fakeSource';

// Only these server integration tests bypass the client-import poison pill.
vi.mock('server-only', () => ({}));

const ids = EVENTS.slice(0, 3).map((event) => event.id);

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('refresh containment', () => {
  it('passes exactly two real events to the adapter once', async () => {
    const fake = await registerFakeSource();
    const { refreshSignals } = await import('../server');

    const signals = await refreshSignals(ids.slice(0, 2));

    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    expect(fake.receivedIds).toEqual([ids.slice(0, 2)]);
    expect(signals).toEqual({
      [ids[0]]: { searchInterest: 73 },
      [ids[1]]: { searchInterest: 73 },
    });
  });

  it('passes all events through the deliberate sweep path', async () => {
    const fake = await registerFakeSource();
    const { sweepAllSignals } = await import('../server');

    const signals = await sweepAllSignals();

    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    expect(fake.receivedIds).toEqual([EVENTS.map((event) => event.id)]);
    expect(Object.keys(signals)).toHaveLength(EVENTS.length);
  });

  it('shares in-flight work for the same ids regardless of order or force', async () => {
    const fake = await registerFakeSource();
    const { refreshSignals } = await import('../server');
    const fetch = fake.fetchSignals.getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    fake.fetchSignals.mockImplementation(async (events) => {
      await gate;
      return fetch(events);
    });

    const first = refreshSignals(ids.slice(0, 2), { force: true });
    const second = refreshSignals([ids[1], ids[0]], { force: true });
    await Promise.resolve();
    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    release();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    expect(fake.receivedIds).toEqual([ids.slice(0, 2)]);
  });

  it('fetches only new ids when subsets partially overlap', async () => {
    const fake = await registerFakeSource();
    const { refreshSignals } = await import('../server');

    const [a, b] = await Promise.all([
      refreshSignals(ids.slice(0, 2), { force: true }),
      refreshSignals(ids.slice(1), { force: true }),
    ]);

    expect(fake.receivedIds).toEqual([ids.slice(0, 2), [ids[2]]]);
    expect(Object.keys(a)).toEqual(ids.slice(0, 2));
    expect(Object.keys(b)).toEqual(ids.slice(1));
  });

  it('shares overlapping sweep and subset work', async () => {
    const fake = await registerFakeSource();
    const { refreshSignals, sweepAllSignals } = await import('../server');
    await Promise.all([sweepAllSignals(), refreshSignals(ids, { force: true }), sweepAllSignals()]);
    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    expect(fake.receivedIds).toEqual([EVENTS.map((event) => event.id)]);
  });

  it('enforces the subset cap in both facade entry points before deduplication', async () => {
    const fake = await registerFakeSource();
    const { getSignalPatches, refreshSignals, MAX_IDS } = await import('../server');
    const tooMany = Array.from({ length: MAX_IDS + 1 }, () => ids[0]);

    await expect(refreshSignals(tooMany)).rejects.toThrow('At most 60 ids');
    await expect(getSignalPatches(tooMany)).rejects.toThrow('At most 60 ids');
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it('does not fetch for empty/unknown ids and deduplicates known ids', async () => {
    const fake = await registerFakeSource();
    const { refreshSignals } = await import('../server');
    expect(await refreshSignals([])).toEqual({});
    expect(await refreshSignals(['missing'])).toEqual({});
    expect(fake.fetchSignals).not.toHaveBeenCalled();
    await refreshSignals([ids[0], ids[0], 'missing']);
    expect(fake.receivedIds).toEqual([[ids[0]]]);
  });

  it('keeps separate TTLs and does not discard another subset when caching', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
    const fake = await registerFakeSource();
    const { getCachedSignalPatches, refreshSignals, SIGNAL_TTL_MS } = await import('../server');
    await refreshSignals([ids[0]]);
    vi.advanceTimersByTime(SIGNAL_TTL_MS / 2);
    await refreshSignals([ids[1]]);
    await refreshSignals(ids.slice(0, 2));
    expect(fake.fetchSignals).toHaveBeenCalledTimes(2);
    expect([...getCachedSignalPatches(ids).keys()]).toEqual(ids.slice(0, 2));

    vi.advanceTimersByTime(SIGNAL_TTL_MS / 2);
    expect([...getCachedSignalPatches(ids).keys()]).toEqual([ids[1]]);
    await refreshSignals(ids);
    expect(fake.receivedIds).toEqual([[ids[0]], [ids[1]], [ids[0], ids[2]]]);
  });

  it('caches empty patches and releases the guard for a later forced refresh', async () => {
    const fake = await registerFakeSource();
    fake.fetchSignals.mockResolvedValue(new Map());
    const { refreshSignals } = await import('../server');
    expect(await refreshSignals(ids)).toEqual({});
    expect(await refreshSignals(ids)).toEqual({});
    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    await refreshSignals(ids, { force: true });
    expect(fake.fetchSignals).toHaveBeenCalledTimes(2);
  });

  it('isolates a failed adapter and allows the next authorized refresh', async () => {
    const fake = await registerFakeSource();
    fake.fetchSignals.mockRejectedValueOnce(new Error('Vendor unavailable'));
    const { refreshSignals } = await import('../server');
    expect(await refreshSignals(ids)).toEqual({});
    const signals = await refreshSignals(ids, { force: true });
    expect(Object.keys(signals)).toEqual(ids);
    expect(fake.fetchSignals).toHaveBeenCalledTimes(2);
  });

  it('ignores adapter patches outside the supplied subset', async () => {
    const fake = await registerFakeSource();
    fake.fetchSignals.mockResolvedValue(new Map([
      [ids[0], { searchInterest: 73 }],
      [ids[2], { searchInterest: 99 }],
    ]));
    const { collectSignalPatches } = await import('../sources');
    const patches = await collectSignalPatches(EVENTS.slice(0, 2));
    expect([...patches.keys()]).toEqual([ids[0]]);
    expect(fake.fetchSignals.mock.calls[0][0].map((event) => event.id)).toEqual(ids.slice(0, 2));
  });
});
