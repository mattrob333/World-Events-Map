import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readTripLink } from '@/lib/designer/tripShare';
import { createDopeMcpServer } from '../server';

async function connect() {
  const server = createDopeMcpServer({ origin: 'https://dope.travel', request: new Request('https://dope.travel/api/mcp', { method: 'POST' }) });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

describe('dope.travel MCP tools', () => {
  it('lists the trip tools', async () => {
    const client = await connect();
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(['dope_plan_trip', 'dope_find_stays', 'dope_read_playlist', 'dope_save_profile']));
  });

  it('plans a trip anywhere and hands back a link the traveler owns', async () => {
    const client = await connect();
    const response = await client.callTool({
      name: 'dope_plan_trip',
      arguments: {
        place: 'Nashville, Tennessee',
        startDate: '2027-04-02',
        nights: 3,
        travelers: [{ name: 'Matt' }, { name: 'Jess' }, { name: 'Kai', age: 7 }],
        foods: ['hot chicken'],
        music: ['classic rock'],
      },
    });
    const structured = response.structuredContent as { tripUrl: string; stays: { href: string }[]; destination: string };
    expect(structured.destination).toBe('Nashville');
    expect(structured.stays[0].href).toContain('adults=2');
    const opened = await readTripLink(structured.tripUrl.split('#t=')[1]);
    expect(opened.handoff).toBe(true);
    expect(opened.trip.participants.map((p) => p.kind)).toEqual(['adult', 'adult', 'kid']);
    expect(opened.trip.cards?.some((card) => card.title === 'hot chicken in Nashville')).toBe(true);
  });

  it('is honest when playlist reading is not configured', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '');
    const client = await connect();
    const response = await client.callTool({ name: 'dope_read_playlist', arguments: { link: 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M' } });
    expect(response.isError).toBe(true);
    expect(JSON.stringify(response.content)).toContain('isn’t set up');
    vi.unstubAllEnvs();
  });
});
