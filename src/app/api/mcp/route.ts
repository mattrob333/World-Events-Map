import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { RequestTooLargeError, consumeProviderCall, readJson } from '@/lib/designer/server/guard';
import { createDopeMcpServer } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BODY_BYTES = 64_000;
/** JSON-RPC batch cap. Current MCP clients send one message per request; batches are legacy. */
export const MAX_BATCH_MESSAGES = 10;

const rpcError = (status: number, code: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ jsonrpc: '2.0', error: { code, message }, id: null }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

/**
 * Remote MCP endpoint (Streamable HTTP, stateless JSON). Any MCP-capable AI
 * agent can connect at /api/mcp. A fresh server per request keeps it
 * stateless and safe to scale.
 *
 * Abuse limits: the body is capped on the bytes actually streamed (not just
 * the declared Content-Length), batches are capped, and every JSON-RPC
 * message spends one unit of the per-client `mcp` limiter. Paid or quota
 * providers behind the tools also sit behind their own daily budgets.
 */
export async function POST(request: Request): Promise<Response> {
  let parsedBody: unknown;
  try {
    parsedBody = await readJson(request, MAX_BODY_BYTES);
  } catch (cause) {
    if (cause instanceof RequestTooLargeError) return rpcError(413, -32600, 'Request too large');
    return rpcError(400, -32700, 'Parse error: Invalid JSON');
  }
  if (parsedBody === null || parsedBody === undefined) return rpcError(400, -32700, 'Parse error: Invalid JSON');
  const messages = Array.isArray(parsedBody) ? parsedBody.length : 1;
  if (Array.isArray(parsedBody) && (messages === 0 || messages > MAX_BATCH_MESSAGES)) {
    return rpcError(400, -32600, `Invalid Request: a batch must hold 1–${MAX_BATCH_MESSAGES} messages`);
  }
  if (!consumeProviderCall(request, 'mcp', Date.now(), messages)) {
    return rpcError(429, -32000, 'Too many requests from this client. Try again in a few minutes.', { 'Retry-After': '120' });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const server = createDopeMcpServer({ origin, request });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request, { parsedBody });
  } finally {
    void server.close();
  }
}

/**
 * Stateless server: there is no standalone SSE stream to open with GET and no
 * session to end with DELETE. The MCP Streamable HTTP client treats 405 on
 * both as "not offered" and carries on over POST.
 */
function methodNotAllowed(): Response {
  return rpcError(405, -32000, 'Method not allowed. This MCP endpoint is stateless: use POST.', { Allow: 'POST' });
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
