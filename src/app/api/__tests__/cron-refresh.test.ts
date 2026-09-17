import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/server', () => ({ anyLiveConfigured: () => false, dataMeta: () => ({}), refreshSignals: vi.fn() }));
import { GET } from '../cron/refresh/route';
afterEach(() => vi.unstubAllEnvs());
it('requires configured scheduler authorization even when no vendors are active', async () => {
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(new Request('http://localhost/api/cron/refresh'))).status).toBe(503);
  vi.stubEnv('CRON_SECRET', 'test-secret');
  expect((await GET(new Request('http://localhost/api/cron/refresh'))).status).toBe(401);
  const response = await GET(new Request('http://localhost/api/cron/refresh', { headers: { Authorization: 'Bearer test-secret' } }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ refreshed: 0, reason: 'No live sources configured' });
});
