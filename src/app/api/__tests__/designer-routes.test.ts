import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/designer/server/claude', () => ({
  designerAiConfigured: vi.fn(() => false),
  parseProfileWithClaude: vi.fn(),
  curateItineraryWithClaude: vi.fn(),
}));

import { curateItineraryWithClaude, designerAiConfigured, parseProfileWithClaude } from '@/lib/designer/server/claude';
import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { POST as postItinerary } from '../designer/itinerary/route';
import { POST as postProfile } from '../designer/profile/route';

const configured = vi.mocked(designerAiConfigured);
const parse = vi.mocked(parseProfileWithClaude);
const curate = vi.mocked(curateItineraryWithClaude);

function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost',
      'Sec-Fetch-Site': 'same-origin',
      'x-vercel-forwarded-for': '203.0.113.9',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const trip = {
  destination: 'st-moritz',
  startDate: '2027-02-06',
  nights: 3,
  participants: [
    { name: 'Matt', kind: 'adult', tags: ['sports'] },
    { name: 'Leo', kind: 'kid', age: 12 },
  ],
};

afterEach(() => {
  configured.mockReset().mockReturnValue(false);
  parse.mockReset();
  curate.mockReset();
  resetDesignerLimitsForTests();
});

describe('POST /api/designer/profile', () => {
  it('rejects cross-origin callers before any AI work', async () => {
    configured.mockReturnValue(true);
    const response = await postProfile(request('/api/designer/profile', { transcript: 'I am from Atlanta and love skiing.' }, { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(parse).not.toHaveBeenCalled();
  });

  it('sorts on the device and says so when AI is not configured', async () => {
    const response = await postProfile(request('/api/designer/profile', { transcript: "I'm 44, from Atlanta, Georgia. Braves fan." }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.engine).toBe('on-device');
    expect(body.profile.teams).toEqual(['Atlanta Braves']);
    expect(parse).not.toHaveBeenCalled();
  });

  it('labels Claude output and falls back honestly when the AI fails', async () => {
    configured.mockReturnValue(true);
    parse.mockResolvedValueOnce({ heritage: [], teams: ['Atlanta Braves'], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: 'You love the Braves.' });
    const ok = await (await postProfile(request('/api/designer/profile', { transcript: 'Braves fan from Atlanta, love it.' }))).json();
    expect(ok.engine).toBe('claude');

    parse.mockRejectedValueOnce(new Error('boom'));
    const fallback = await (await postProfile(request('/api/designer/profile', { transcript: 'Braves fan from Atlanta, love it.' }))).json();
    expect(fallback.engine).toBe('on-device');
    expect(fallback.notice).toMatch(/sorted on the device/);
  });

  it('stops paying for AI after the per-client limit and uses the device parser', async () => {
    configured.mockReturnValue(true);
    parse.mockResolvedValue({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '' });
    for (let i = 0; i < 8; i += 1) await postProfile(request('/api/designer/profile', { transcript: 'Braves fan from Atlanta, love it.' }));
    const limited = await (await postProfile(request('/api/designer/profile', { transcript: 'Braves fan from Atlanta, love it.' }))).json();
    expect(parse).toHaveBeenCalledTimes(8);
    expect(limited.engine).toBe('on-device');
  });

  it('requires a real transcript and caps size', async () => {
    expect((await postProfile(request('/api/designer/profile', { transcript: 'hi' }))).status).toBe(400);
    expect((await postProfile(request('/api/designer/profile', { transcript: 'x'.repeat(40_000) }))).status).toBe(413);
    expect((await postProfile(request('/api/designer/profile', '{nope'))).status).toBe(400);
  });
});

describe('POST /api/designer/itinerary', () => {
  it('builds an on-device draft without AI', async () => {
    const response = await postItinerary(request('/api/designer/itinerary', trip));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.itinerary.engine).toBe('on-device');
    expect(body.itinerary.days).toHaveLength(4);
    expect(curate).not.toHaveBeenCalled();
  });

  it('applies AI curation but keeps only catalog cards', async () => {
    configured.mockReturnValue(true);
    curate.mockResolvedValueOnce({ days: [{ index: 1, title: 'Big day', hype: 'Go.', slots: [{ id: 'd1-morning', cardIds: ['st-moritz:invented'], note: undefined }] }] });
    const body = await (await postItinerary(request('/api/designer/itinerary', trip))).json();
    expect(body.itinerary.engine).toBe('claude');
    expect(body.itinerary.days[1].title).toBe('Big day');
    expect(JSON.stringify(body.itinerary)).not.toContain('st-moritz:invented');
  });

  it('returns validation errors as 400', async () => {
    const response = await postItinerary(request('/api/designer/itinerary', { ...trip, nights: 99 }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/nights/);
  });
});
