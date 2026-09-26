import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/now/pulseService', () => ({ executePulse: vi.fn() }));

import { NowProviderBudgetExceededError } from '@/lib/now/providerBudget';
import { executePulse } from '@/lib/now/pulseService';
import { resetNowRateLimitsForTests } from '@/lib/now/rateLimit';
import { POST } from '../now/pulse/route';

const mocked = vi.mocked(executePulse);

function request(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/now/pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.20', ...headers },
    body,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  mocked.mockReset();
  resetNowRateLimitsForTests();
});

describe('POST /api/now/pulse', () => {
  it('says honestly when foot traffic is not connected, without calling the provider', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', '');
    const response = await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'NOW_PROVIDER_NOT_CONFIGURED' });
    expect(mocked).not.toHaveBeenCalled();
  });

  it('refuses other sites', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    const response = await POST(request(JSON.stringify({ location: { lat: 1, lng: 1 } }), { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(mocked).not.toHaveBeenCalled();
  });

  it('needs a real location', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    const response = await POST(request(JSON.stringify({ location: { lat: 200, lng: 0 } })));
    expect(response.status).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it('returns the busiest places', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockResolvedValue({ venues: [], source: 'besttime', generatedAt: '2026-09-26T00:00:00Z', center: { lat: 33.75, lng: -84.39 } });
    const response = await POST(request(JSON.stringify({ location: { lat: 33.7512, lng: -84.3901 } })));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(mocked).toHaveBeenCalledWith({ lat: 33.7512, lng: -84.3901 });
  });

  it('turns a spent budget into a polite retry', async () => {
    vi.stubEnv('BESTTIME_API_KEY_PRIVATE', 'k');
    mocked.mockRejectedValue(new NowProviderBudgetExceededError(120));
    const response = await POST(request(JSON.stringify({ location: { lat: 33.75, lng: -84.39 } })));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('120');
  });
});
