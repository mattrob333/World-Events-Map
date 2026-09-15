import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTS } from '@/lib/data';
import { registerFakeSource } from '@/lib/data/__tests__/fakeSource';

vi.mock('server-only', () => ({}));

const TOKEN = 'refresh-test-secret';
const ids = EVENTS.slice(0, 2).map((event) => event.id);
function request(body: unknown, authorization = `Bearer ${TOKEN}`) {
  return new Request('http://localhost/api/admin/refresh', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('REFRESH_ADMIN_TOKEN', TOKEN);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('authorized refresh route', () => {
  it.each([undefined, '', '   '])('returns 503 when the admin token is %j', async (token) => {
    vi.stubEnv('REFRESH_ADMIN_TOKEN', token);
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const response = await POST(request({ all: true }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Refresh is not configured' });
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it.each(['', 'Bearer wrong', 'Bearer refresh-test-secreu', 'Basic refresh-test-secret'])(
    'returns 401 for missing or wrong credentials: %j', async (authorization) => {
      const fake = await registerFakeSource();
      const { POST } = await import('../admin/refresh/route');
      const response = await POST(request({ all: true }, authorization));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'Unauthorized' });
      expect(fake.fetchSignals).not.toHaveBeenCalled();
    },
  );

  it('refreshes exactly two real events with the correct bearer token', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const response = await POST(request({ ids }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      signals: { [ids[0]]: { searchInterest: 73 }, [ids[1]]: { searchInterest: 73 } },
      unknownIds: [],
      sources: expect.arrayContaining([expect.objectContaining({ id: 'fake', status: 'live' })]),
    });
    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    expect(fake.receivedIds).toEqual([ids]);
  });

  it('rejects 61 supplied ids before filtering, deduplication, or all: true', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    for (const tooMany of [EVENTS.slice(0, 61).map((event) => event.id), Array(61).fill(ids[0])]) {
      const response = await POST(request({ ids: tooMany, all: true }));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'At most 60 ids are allowed' });
    }
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it('accepts the 60-id boundary', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const boundary = EVENTS.slice(0, 60).map((event) => event.id);
    const response = await POST(request({ ids: boundary }));
    expect(response.status).toBe(200);
    expect(fake.receivedIds).toEqual([boundary]);
  });

  it('deliberately sweeps every event for all: true', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const response = await POST(request({ all: true }));
    expect(response.status).toBe(200);
    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
    expect(fake.receivedIds).toEqual([EVENTS.map((event) => event.id)]);
    expect(Object.keys((await response.json()).signals)).toHaveLength(EVENTS.length);
  });

  it('gives ids precedence over all, deduplicates them, and reports unknown ids', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const response = await POST(request({ ids: [ids[0], ` ${ids[0]} `, 'missing'], all: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ unknownIds: ['missing'] });
    expect(fake.receivedIds).toEqual([[ids[0]]]);
    const empty = await POST(request({ ids: [], all: true }));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toMatchObject({ signals: {}, unknownIds: [] });
    expect(fake.fetchSignals).toHaveBeenCalledTimes(1);
  });

  it('allows an authorized refresh to bypass a warm TTL', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    expect((await POST(request({ ids }))).status).toBe(200);
    expect((await POST(request({ ids }))).status).toBe(200);
    expect(fake.receivedIds).toEqual([ids, ids]);
  });

  it.each(
    [null, [], {}, { all: false }, { all: 'true' }, { ids: null }, { ids: 'a,b' }, { ids: [1] }]
      .map((body) => ({ body })),
  )('rejects an invalid body without fetching: $body', async ({ body }) => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON after checking authorization', async () => {
    const fake = await registerFakeSource();
    const { POST } = await import('../admin/refresh/route');
    const response = await POST(new Request('http://localhost/api/admin/refresh', {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: '{',
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
    expect(fake.fetchSignals).not.toHaveBeenCalled();
  });
});
