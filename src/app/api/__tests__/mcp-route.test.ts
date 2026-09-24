import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { POST } from '../mcp/route';

function rpc(method: string, params: Record<string, unknown> = {}, id = 1) {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

describe('POST /api/mcp', () => {
  it('initializes and lists the dope tools', async () => {
    const init = await POST(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }));
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe('dope-travel');
    const list = await (await POST(rpc('tools/list'))).json();
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual([
      'dope_profile_guide', 'dope_save_profile', 'dope_find_events', 'dope_trip_ideas', 'dope_live_music_scene', 'dope_curated_occasions',
    ]);
  });

  it('saves a profile into a private import link without storing it', async () => {
    const body = await (await POST(rpc('tools/call', { name: 'dope_save_profile', arguments: { profile: { hometown: 'Atlanta, Georgia', style: { social: 'small-crew' } } } }))).json();
    const out = body.result.structuredContent;
    expect(out.importUrl).toMatch(/^http:\/\/localhost\/moodboard\/import#p=/);
    expect(out.missing).toContain('who they travel with');
  });

  it('rejects invalid input with a clear error', async () => {
    const body = await (await POST(rpc('tools/call', { name: 'dope_save_profile', arguments: { profile: { style: { budget: 'billionaire' } } } }))).json();
    expect(body.result?.isError ?? Boolean(body.error)).toBe(true);
  });

  it('refuses oversized requests', async () => {
    const big = new Request('http://localhost/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '100000' }, body: '{}' });
    expect((await POST(big)).status).toBe(413);
  });
});
