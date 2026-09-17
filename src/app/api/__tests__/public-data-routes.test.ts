import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data';
import { registerFakeSource } from '@/lib/data/__tests__/fakeSource';

vi.mock('server-only', () => ({}));

beforeEach(() => vi.resetModules());
afterEach(() => vi.restoreAllMocks());

describe('public calendar and source contracts', () => {
  it('serves the cold curated calendar and current diagnostics with their existing headers', async () => {
    const fake = await registerFakeSource();
    const server = await import('@/lib/data/server');
    const eventsRoute = await import('../events/route');
    const sourcesRoute = await import('../sources/route');

    const events = await eventsRoute.GET();
    expect(events.status).toBe(200);
    expect(events.headers.get('Cache-Control')).toBe('no-store');
    expect(await events.json()).toEqual({ events: EVENTS, meta: { ...server.dataMeta(), partnerStatus: 'available' } });

    const sources = await sourcesRoute.GET();
    expect(sources.status).toBe(200);
    expect(sources.headers.get('Cache-Control')).toBe('no-store');
    expect(await sources.json()).toEqual({
      sources: server.getSourceHealth(), signalCacheAgeMs: null, signalTtlMs: server.SIGNAL_TTL_MS,
    });
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it('merges authorized cached patches into the calendar without mutating the baseline', async () => {
    const fake = await registerFakeSource();
    const server = await import('@/lib/data/server');
    const baseline = { ...EVENTS[0].signals };
    await server.refreshSignals([EVENTS[0].id]);
    fake.fetchSignals.mockClear();
    const { GET } = await import('../events/route');

    const response = await GET();
    const body = await response.json();
    expect(body.events).toHaveLength(EVENTS.length);
    expect(body.events[0].signals).toEqual({ ...baseline, searchInterest: 73 });
    expect(body.events[1]).toEqual(EVENTS[1]);
    expect(EVENTS[0].signals).toEqual(baseline);
    expect(body.meta.signalCacheAgeMs).toEqual(expect.any(Number));
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });
});
