import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/now/service', () => ({ executeNow: vi.fn() }));

import {
  NowProviderBudgetExceededError,
  NowProviderBudgetUnavailableError,
} from '@/lib/now/providerBudget';
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

function request(
  body: string,
  ip = '203.0.113.10',
  headers: Record<string, string> = {},
) {
  return new Request('http://localhost/api/now', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      'Sec-Fetch-Site': 'same-origin',
      'x-vercel-forwarded-for': ip,
      ...headers,
    },
    body,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  mockedExecuteNow.mockReset();
  resetNowRateLimitsForTests();
});

describe('POST /api/now', () => {
  it('requires application/json before any provider work', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    const response = await POST(
      request(validBody(), '203.0.113.1', { 'Content-Type': 'text/plain' }),
    );

    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'NOW_JSON_REQUIRED' });
    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('rejects cross-origin browser requests before any provider work', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    const response = await POST(
      request(validBody(), '203.0.113.2', {
        Origin: 'https://attacker.example',
        'Sec-Fetch-Site': 'cross-site',
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'NOW_SAME_ORIGIN_REQUIRED' });
    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('fails closed when the required venue provider is not configured', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
    const response = await POST(request(JSON.stringify({})));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'NOW_PROVIDER_NOT_CONFIGURED' });
  });

  it('rejects malformed location and constraints before calling providers', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    const response = await POST(
      request(
        JSON.stringify({
          location: { lat: 190, lng: 0 },
          intent: 'food',
          vibe: 'social',
          radiusMeters: 3000,
        }),
      ),
    );
    expect(response.status).toBe(400);
    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('rejects oversized chunked-style bodies before buffering provider work', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    const response = await POST(request(JSON.stringify({ padding: 'x'.repeat(21_000) })));
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'NOW_REQUEST_TOO_LARGE' });
    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('keeps repeated invalid requests out of the provider service', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');

    for (let index = 0; index < 12; index += 1) {
      const response = await POST(request('{bad json', `203.0.113.${index + 20}`));
      expect(response.status).toBe(400);
    }

    expect(mockedExecuteNow).not.toHaveBeenCalled();
  });

  it('rate limits a warm-instance client before provider work', async () => {
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
      response = await POST(request(validBody(), '203.0.113.10'));
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get('retry-after')).toBeTruthy();
    expect(mockedExecuteNow).toHaveBeenCalledTimes(12);
  });

  it('returns durable provider-budget exhaustion as a retriable 429', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    mockedExecuteNow.mockRejectedValue(new NowProviderBudgetExceededError(37));

    const response = await POST(request(validBody()));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('37');
    expect(await response.json()).toMatchObject({ code: 'NOW_RATE_LIMITED' });
  });

  it('fails closed when durable provider accounting is unavailable', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'test-private-key');
    mockedExecuteNow.mockRejectedValue(new NowProviderBudgetUnavailableError());

    const response = await POST(request(validBody()));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'NOW_BUDGET_UNAVAILABLE' });
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

    const response = await POST(request(validBody()));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mockedExecuteNow).toHaveBeenCalledTimes(1);
  });
});
