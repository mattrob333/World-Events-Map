import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/now/service', () => ({ executeNow: vi.fn() }));

import { executeNow } from '@/lib/now/service';
import { POST } from '../now/route';

const mockedExecuteNow = vi.mocked(executeNow);

afterEach(() => {
  vi.unstubAllEnvs();
  mockedExecuteNow.mockReset();
});

describe('POST /api/now', () => {
  it('fails closed when the required venue provider is not configured', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
    const response = await POST(
      new Request('http://localhost/api/now', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'NOW_PROVIDER_NOT_CONFIGURED' });
  });

  it('rejects malformed location and constraints before calling providers', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    const response = await POST(
      new Request('http://localhost/api/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { lat: 190, lng: 0 },
          intent: 'food',
          vibe: 'social',
          radiusMeters: 3000,
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('returns the decision result without caching the HTTP response', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    mockedExecuteNow.mockResolvedValue({
      picks: [],
      candidateCount: 0,
      venueSource: 'besttime',
      judgmentSource: 'meridian-deterministic',
      generatedAt: '2026-09-17T18:00:00.000Z',
      degraded: true,
      warnings: ['No venue met the current hard constraints.'],
    });

    const response = await POST(
      new Request('http://localhost/api/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { lat: 40.758, lng: -73.9855 },
          intent: 'drinks',
          vibe: 'social',
          radiusMeters: 3000,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mockedExecuteNow).toHaveBeenCalledTimes(1);
  });
});
