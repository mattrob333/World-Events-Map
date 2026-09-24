import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readTripLink } from '@/lib/designer/tripShare';
import { decodeProfile } from '@/lib/designer/share';
import { createDopeMcpServer, looksLikePlace } from '../server';

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
    expect(JSON.stringify(response.content)).toContain('Spotify isn’t connected on this server');
    vi.unstubAllEnvs();
  });

  it('keeps the traveler’s taste on their own trip link and prints a clean outline (H12, H18)', async () => {
    const client = await connect();
    const response = await client.callTool({
      name: 'dope_plan_trip',
      arguments: { place: 'Nashville, Tennessee', startDate: '2027-04-02', nights: 3, travelers: [{ name: 'Matt' }], music: ['classic rock'], artists: ['Tom Petty'] },
    });
    const structured = response.structuredContent as { tripUrl: string };
    const opened = await readTripLink(structured.tripUrl.split('#t=')[1]);
    expect(opened.trip.taste?.topArtists).toEqual(['Tom Petty']);
    const text = JSON.stringify(response.content);
    expect(text).not.toContain('Après');
    expect(text).not.toMatch(/: —/);
  });

  it('rejects past dates and keyboard mashing politely (H15)', async () => {
    const client = await connect();
    const past = await client.callTool({ name: 'dope_plan_trip', arguments: { place: 'Lisbon', startDate: '2020-05-01', nights: 2, travelers: [{ name: 'A' }] } });
    expect(past.isError).toBe(true);
    expect(JSON.stringify(past.content)).toContain('in the past');
    const mash = await client.callTool({ name: 'dope_plan_trip', arguments: { place: 'asdfghjkl qwerty', startDate: '2027-05-01', nights: 2, travelers: [{ name: 'A' }] } });
    expect(mash.isError).toBe(true);
    const stays = await client.callTool({ name: 'dope_find_stays', arguments: { place: 'Lisbon', checkIn: '2020-01-01', nights: 2, adults: 2 } });
    expect(stays.isError).toBe(true);
    for (const real of ['Lisbon, Portugal', 'São Paulo', 'Szczecin', 'Llanfairpwllgwyngyll', 'St. Moritz', '東京', 'Park City, UT']) expect(looksLikePlace(real)).toBe(true);
    for (const junk of ['asdfghjkl qwerty', 'xkcdbrrrt', '12345', 'https://evil.example']) expect(looksLikePlace(junk)).toBe(false);
  });

  it('says plainly when event listings are not set up (H08, H09)', async () => {
    vi.stubEnv('TICKETMASTER_API_KEY', '');
    vi.stubEnv('SEATGEEK_CLIENT_ID', '');
    const client = await connect();
    const tools = (await client.listTools()).tools;
    expect(tools.find((t) => t.name === 'dope_find_events')?.description).toContain('aren’t set up');
    const teamsOnly = await client.callTool({ name: 'dope_find_events', arguments: { teams: ['Atlanta Braves'] } });
    const links = (teamsOnly.structuredContent as { links: { href: string }[] }).links;
    expect(links.length).toBeGreaterThan(0);
    expect(JSON.stringify(teamsOnly.content)).toContain('Atlanta Braves');
    expect(JSON.stringify(teamsOnly.content)).toContain('aren’t set up on this server');
    const scene = await client.callTool({ name: 'dope_live_music_scene', arguments: { city: 'Austin', genres: ['rock'] } });
    expect(JSON.stringify(scene.content)).toContain('Event listings aren’t set up on this server');
    vi.unstubAllEnvs();
  });

  it('opens with the five prompts only for profile setup and never invites a playlist Spotify can’t read (H06, H10)', async () => {
    vi.stubEnv('SPOTIFY_CLIENT_SECRET', '');
    const client = await connect();
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('asks to set up their dope.travel profile');
    expect(instructions).toContain('don\'t open with the five prompts');
    expect(instructions).not.toContain('Paste the link');
    const guide = (await client.callTool({ name: 'dope_profile_guide', arguments: {} })).structuredContent as {
      checklist: { music: string };
      liveData: { spotifyPlaylist: string };
    };
    expect(guide.checklist.music).toContain('artists');
    expect(guide.liveData.spotifyPlaylist).toContain('Spotify isn’t connected');
    vi.unstubAllEnvs();
  });

  it('saves named artists, re-caps merged lists, and refuses a link that would be too long (H01, H07)', async () => {
    const client = await connect();
    const saved = await client.callTool({
      name: 'dope_save_profile',
      arguments: {
        profile: { artists: ['Pearl Jam'], music: ['rock', 'jazz', 'soul', 'funk', 'blues', 'house', 'techno', 'disco', 'metal', 'punk'] },
        about: "I'm Matt, 44, from Atlanta. I love hip hop, reggae, country, gospel and grunge. Foo Fighters, Pearl Jam, Tom Petty.",
      },
    });
    const out = saved.structuredContent as { importUrl: string; profile: { artists: string[]; music: string[]; name: string } };
    expect(out.profile.artists).toEqual(['Pearl Jam', 'Foo Fighters', 'Tom Petty']);
    expect(out.profile.music.length).toBeLessThanOrEqual(10);
    expect(out.profile.name).toBe('Matt');
    expect(decodeProfile(out.importUrl.split('#p=')[1])?.artists).toEqual(['Pearl Jam', 'Foo Fighters', 'Tom Petty']);

    const long = (n: number) => Array.from({ length: n }, (_, i) => `${'x'.repeat(70)} ${i} ${'y'.repeat(5)}`);
    const huge = await client.callTool({
      name: 'dope_save_profile',
      arguments: {
        profile: {
          heritage: long(6), teams: long(8), music: long(10), artists: long(10), events: long(10), favoriteTrips: long(8), interests: long(14), food: long(8),
          bestMoments: Array.from({ length: 5 }, () => 'z'.repeat(400)),
          style: { lodging: long(6), dietary: long(8), avoid: long(10), bucketList: long(12), languages: long(8), notes: 'n'.repeat(600) },
        },
      },
    });
    expect(huge.isError).toBe(true);
    expect(JSON.stringify(huge.content)).toContain('too big to fit in a link');
  });
});
