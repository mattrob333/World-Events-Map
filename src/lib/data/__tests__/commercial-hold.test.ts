import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data';

vi.mock('server-only', () => ({}));

afterEach(() => vi.unstubAllEnvs());

describe('commercial hold', () => {
  it('leaves Ticketmaster, PredictHQ, and Amadeus unconfigured and does not call them', async () => {
    vi.resetModules();
    vi.stubEnv('TICKETMASTER_API_KEY', 'fixture-not-a-live-key');
    vi.stubEnv('PREDICTHQ_TOKEN', 'fixture-not-a-live-key');
    vi.stubEnv('AMADEUS_CLIENT_ID', 'fixture-not-a-live-key');
    vi.stubEnv('AMADEUS_CLIENT_SECRET', 'fixture-not-a-live-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { collectSignalPatches, getSourceHealth } = await import('../sources');

    const health = getSourceHealth();
    for (const id of ['ticketmaster', 'predicthq', 'amadeus']) {
      expect(health.find((source) => source.id === id)).toMatchObject({
        status: 'unconfigured',
      });
    }

    await collectSignalPatches(EVENTS.slice(0, 1));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
