import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { DELETE, GET, MAX_BATCH_MESSAGES, POST } from '../mcp/route';

process.env.MCP_ACCESS_TOKEN = 'test-mcp-token-0123456789abcdef';
const HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: 'Bearer test-mcp-token-0123456789abcdef' };
const msg = (id: number) => ({ jsonrpc: '2.0', id, method: 'tools/list', params: {} });

afterEach(() => {
  vi.unstubAllEnvs();
  resetDesignerLimitsForTests();
});

describe('/api/mcp abuse limits', () => {
  it('caps the body on streamed bytes, not only the declared length', async () => {
    const chunk = new TextEncoder().encode(' '.repeat(16_000));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= 20) return controller.close();
        sent += 1;
        controller.enqueue(chunk);
      },
    });
    const chunked = new Request('http://localhost/api/mcp', { method: 'POST', headers: HEADERS, body, duplex: 'half' } as RequestInit);
    const response = await POST(chunked);
    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(20); // stopped reading early
  });

  it('caps batch size', async () => {
    const batch = Array.from({ length: MAX_BATCH_MESSAGES + 1 }, (_, i) => msg(i + 1));
    const response = await POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: HEADERS, body: JSON.stringify(batch) }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32600);
  });

  it('rate-limits each client by JSON-RPC message', async () => {
    vi.stubEnv('VERCEL', '1');
    const from = (ip: string) => new Request('http://localhost/api/mcp', { method: 'POST', headers: { ...HEADERS, 'x-real-ip': ip }, body: JSON.stringify(msg(1)) });
    let ok = 0;
    let limited: Response | null = null;
    for (let i = 0; i < 260; i += 1) {
      const response = await POST(from('198.51.100.1'));
      if (response.status === 429) {
        limited = response;
        break;
      }
      ok += 1;
    }
    expect(ok).toBe(240);
    expect(limited?.headers.get('Retry-After')).toBeTruthy();
    expect((await POST(from('198.51.100.2'))).status).toBe(200);
  });

  it('answers 405 to GET and DELETE on the stateless endpoint, and POST still works', async () => {
    expect((await GET()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
    expect((await GET()).headers.get('Allow')).toBe('POST');
    const init = await POST(new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } }),
    }));
    expect(init.status).toBe(200);
  });

  it('still works end to end with the official Streamable HTTP client (which probes GET and gets 405)', async () => {
    const methods: string[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      request.headers.set('Authorization', 'Bearer test-mcp-token-0123456789abcdef');
      methods.push(request.method);
      return request.method === 'POST' ? POST(request) : request.method === 'GET' ? GET() : DELETE();
    };
    const client = new Client({ name: 'test', version: '1' });
    await client.connect(new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), { fetch: fetchImpl }));
    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThan(0);
    await client.close();
    expect(methods).toContain('POST');
  });
});
