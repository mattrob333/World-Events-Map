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
      'dope_read_playlist', 'dope_plan_trip', 'dope_find_stays',
    ]);
  });

  it('opens with the five-part ramble invitation on connect', async () => {
    const init = await (await POST(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }))).json();
    const instructions: string = init.result.instructions;
    expect(instructions).toMatch(/Ramble, go on tangents/);
    for (const topic of ['An experience you loved', 'How you like to travel', 'Food', 'Music', 'Your best moment ever on a trip']) {
      expect(instructions).toContain(topic);
    }
    const prompts = await (await POST(rpc('prompts/list'))).json();
    expect(prompts.result.prompts.map((p: { name: string }) => p.name)).toEqual(['dope_start']);
    const start = await (await POST(rpc('prompts/get', { name: 'dope_start' }))).json();
    expect(start.result.messages[0].content.text).toContain('Your best moment ever on a trip');
  });

  it('keeps best moments in the traveler’s own words', async () => {
    const body = await (await POST(rpc('tools/call', { name: 'dope_save_profile', arguments: {
      about: 'We went to a tiny hostel in Lisbon and the bar downstairs was legit.',
      profile: { bestMoments: ['Ran the most legendary night in a tiny hostel room in Lisbon.'], style: { lodging: ['social hostel with a bar'] } },
    } }))).json();
    const out = body.result.structuredContent;
    expect(out.profile.bestMoments).toEqual(['Ran the most legendary night in a tiny hostel room in Lisbon.']);
    expect(out.missing).not.toContain('their best moment on a trip');
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
