import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data';
import { registerFakeSource } from '@/lib/data/__tests__/fakeSource';

vi.mock('server-only', () => ({}));

const ids = EVENTS.slice(0, 2).map((event) => event.id);

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function setup() {
  const fake = await registerFakeSource();
  const server = await import('@/lib/data/server');
  const { GET } = await import('../travel-wire/route');
  return { fake, server, GET };
}

describe('public travel wire', () => {
  it('returns an empty wire on a cold cache and does not call vendors', async () => {
    const { fake, GET } = await setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.status).toBe('empty');
    expect(body.cards).toEqual([]);
    expect(fake.fetchSignals).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads a patch already collected by refresh and does not fetch again', async () => {
    const { fake, server, GET } = await setup();
    await server.refreshSignals(ids);
    fake.fetchSignals.mockClear();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.cards.length).toBe(ids.length);
    expect(body.cards.every((card: { sourceId: string; metric: string; delta: string; headline: string; value?: number }) =>
      card.sourceId === 'fake' &&
      card.metric === 'search_interest' &&
      card.delta === 'new' &&
      card.value === 73 &&
      !/attendance|\$\d|sold out|viral/i.test(card.headline),
    )).toBe(true);
    expect(fake.fetchSignals).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
