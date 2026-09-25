import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pending: (() => Promise<void>)[] = [];
vi.mock('server-only', () => ({}));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: (fn: () => Promise<void>) => pending.push(fn) }));

import { resetDailyBudgetsForTests } from '@/lib/designer/server/dailyBudget';
import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { liveSessionConfig } from '@/lib/voice/session';
import { INTENT_TOOLS, routeFor } from '@/lib/voice/tools';
import { GET, POST, sessionIdFrom } from '../voice/session/route';

const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/voice/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': '203.0.113.7', ...headers },
    body: JSON.stringify(body),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('OPENAI_API_KEY', 'sk-test');
  vi.stubEnv('VOICE_ENABLED', '1');
  fetchMock.mockImplementation(async (url: string) =>
    String(url).endsWith('/hangup')
      ? new Response(null, { status: 200 })
      : new Response(JSON.stringify({ session: { id: 'live_test123' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer\r\n' } }), { status: 201, headers: { 'Content-Type': 'application/json' } }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  pending.length = 0;
  resetDesignerLimitsForTests();
  resetDailyBudgetsForTests();
  vi.useRealTimers();
});

describe('GET /api/voice/session', () => {
  it('reports whether voice is on without revealing anything else', async () => {
    expect(await GET().json()).toEqual({ enabled: true });
    vi.stubEnv('VOICE_ENABLED', '0');
    expect(await GET().json()).toEqual({ enabled: false });
  });
});

describe('POST /api/voice/session', () => {
  it('is off unless VOICE_ENABLED=1, even with a key', async () => {
    vi.stubEnv('VOICE_ENABLED', '');
    const response = await POST(request({ intent: 'trip', sdp: OFFER }));
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses cross-origin callers before calling OpenAI', async () => {
    const response = await POST(request({ intent: 'trip', sdp: OFFER }, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects anything that is not an SDP offer', async () => {
    const response = await POST(request({ intent: 'trip', sdp: 'hello' }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('opens the call server-side, returns only the answer, and hangs up at the cap', async () => {
    vi.useFakeTimers();
    const response = await POST(request({ intent: 'trip', context: 'Trip setup form.', sdp: OFFER }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sdp).toContain('answer');
    expect(JSON.stringify(body)).not.toContain('sk-test');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/live/sessions');
    const sent = JSON.parse(init.body as string);
    expect(sent.transport).toEqual({ type: 'webrtc', sdp: OFFER });
    expect(sent.session.model).toBe('gpt-live-1');
    expect(sent.session.delegation.type).toBe('responses');
    expect(sent.session.delegation.responses.tools.map((tool: { name?: string; type: string }) => tool.name ?? tool.type)).toEqual(INTENT_TOOLS.trip);

    expect(pending).toHaveLength(1);
    const done = pending[0]();
    await vi.advanceTimersByTimeAsync(240_000);
    await done;
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.openai.com/v1/live/sessions/live_test123/hangup');
  });

  it('withholds the answer when no call id comes back, so the cap is always enforceable', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ transport: { sdp: 'v=0\r\nanswer\r\n' } }), { status: 201 }));
    const response = await POST(request({ intent: 'trip', sdp: OFFER }));
    expect(response.status).toBe(502);
    expect(pending).toHaveLength(0);
  });

  it('rate limits a single client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 10; i++) statuses.push((await POST(request({ intent: 'general', sdp: OFFER }))).status);
    expect(statuses).toContain(429);
  });
});

describe('voice helpers', () => {
  it('accepts only safe session ids', () => {
    expect(sessionIdFrom('live_abc123')).toBe('live_abc123');
    expect(sessionIdFrom(null)).toBeNull();
    expect(sessionIdFrom('../../x y')).toBeNull();
  });

  it('only routes to known pages', () => {
    expect(routeFor('trips')).toBe('/trips');
    expect(routeFor('constructor')).toBeNull();
    expect(routeFor('toString')).toBeNull();
  });

  it('scrubs the page context', () => {
    const config = liveSessionConfig('general', '<script>x</script>\u0000', '', 'nope');
    expect(config.instructions).not.toContain('<script>');
    expect(config.instructions).toMatch(/Today is \d{4}-\d{2}-\d{2}/);
  });
});
