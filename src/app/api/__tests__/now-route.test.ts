import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/now/service', () => ({ executeNow: vi.fn() }));

import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';
import { executeNow } from '@/lib/now/service';
import { POST } from '../now/route';

const mockedExecuteNow = vi.mocked(executeNow);

function validBody() {
  return JSON.stringify({
    location: { lat: 40.758, lng: -73.9855 },
    intent: 'drinks',
    vibe: 'social',
    radiusMeters: 3000,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  mockedExecuteNow.mockReset();
  resetNowRateLimitsForTests();
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

  it('rejects oversized request bodies before provider work', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    const response = await POST(
      new Request('http://localhost/api/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ padding: 'x'.repeat(21_000) }),
      }),
    );
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'NOW_REQUEST_TOO_LARGE' });
    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('rate limits a warm-instance client before paid provider work', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    mockedExecuteNow.mockResolvedValue({
      picks: [],
      candidateCount: 0,
      venueSource: 'besttime',
      judgmentSource: 'meridian-deterministic',
      generatedAt: '2026-09-17T18:00:00.000Z',
      degraded: true,
      warnings: [],
    });

    let response: Response | undefined;
    for (let index = 0; index < 13; index += 1) {
      response = await POST(
        new Request('http://localhost/api/now', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '203.0.113.10',
          },
          body: validBody(),
        }),
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBeTruthy();
    expect(mockedExecuteNow).toHaveBeenCalledTimes(12);
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
        body: validBody(),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mockedExecuteNow).toHaveBeenCalledTimes(1);
  });
});
