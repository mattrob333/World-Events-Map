import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createDopeMcpServer } from '@/lib/mcp/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BODY_BYTES = 64_000;

/**
 * Remote MCP endpoint (Streamable HTTP, stateless JSON). Any MCP-capable AI
 * agent can connect at /api/mcp. A fresh server per request keeps it
 * stateless and safe to scale.
 */
async function handle(request: Request): Promise<Response> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return Response.json({ jsonrpc: '2.0', error: { code: -32600, message: 'Request too large' }, id: null }, { status: 413 });
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const server = createDopeMcpServer({ origin, request });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    void server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
