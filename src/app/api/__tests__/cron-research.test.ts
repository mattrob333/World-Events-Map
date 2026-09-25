import { afterEach, expect, it, vi } from 'vitest';

const { rpc, runResearchSweep, signalDatabase } = vi.hoisted(() => ({
  rpc: vi.fn(),
  runResearchSweep: vi.fn(),
  signalDatabase: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/data/durable', () => ({ signalDatabase }));
vi.mock('@/lib/research/pipeline', () => ({ runResearchSweep }));

import { GET } from '../cron/research/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function request(secret?: string) {
  return new Request('http://localhost/api/cron/research?query=ignored', {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

it('requires scheduler auth and every provider before claiming paid work', async () => {
  vi.stubEnv('CRON_SECRET', '');
  expect((await GET(request())).status).toBe(401);
  vi.stubEnv('CRON_SECRET', 'test-secret');
  expect((await GET(request())).status).toBe(401);
  vi.stubEnv('EXA_API_KEY', '');
  vi.stubEnv('TREG_TOKEN', '');
  vi.stubEnv('TYPESAFE_API_KEY', '');
  expect((await GET(request('test-secret'))).status).toBe(503);
  expect(signalDatabase).not.toHaveBeenCalled();
  expect(runResearchSweep).not.toHaveBeenCalled();
});

it('requires the durable lease and invokes at most one fixed sweep', async () => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  vi.stubEnv('EXA_API_KEY', 'exa');
  vi.stubEnv('TREG_TOKEN', 'treg');
  vi.stubEnv('TYPESAFE_API_KEY', 'jev');
  signalDatabase.mockReturnValue({ rpc });
  rpc.mockResolvedValueOnce({ data: false, error: null });
  expect((await GET(request('test-secret'))).status).toBe(200);
  expect(runResearchSweep).not.toHaveBeenCalled();
  rpc.mockResolvedValueOnce({ data: true, error: null });
  runResearchSweep.mockResolvedValueOnce({ found: 8, published: 2, review: 5, rejected: 1, sources: { exa: 'updated', treg: 'updated' } });
  const response = await GET(request('test-secret'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ran: true, found: 8, published: 2 });
  expect(runResearchSweep).toHaveBeenCalledTimes(1);
});

it('records a failed sweep without replacing the last completed timestamp', async () => {
  vi.stubEnv('CRON_SECRET', 'test-secret');
  vi.stubEnv('EXA_API_KEY', 'exa');
  vi.stubEnv('TREG_TOKEN', 'treg');
  vi.stubEnv('TYPESAFE_API_KEY', 'jev');
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  signalDatabase.mockReturnValue({ rpc, from: vi.fn(() => ({ update })) });
  rpc.mockResolvedValueOnce({ data: true, error: null });
  runResearchSweep.mockRejectedValueOnce(new Error('provider failed'));
  expect((await GET(request('test-secret'))).status).toBe(503);
  expect(update).toHaveBeenCalledWith({ last_status: 'error' });
});
