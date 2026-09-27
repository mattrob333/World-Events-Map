import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: () => undefined }));
vi.mock('@/lib/jev/receipts', () => ({ storeReceipts: vi.fn(async () => {}) }));
vi.mock('@/lib/platform/server/member', () => ({ requireMember: async () => ({ id: 'member', email: null }) }));
vi.mock('@/lib/designer/server/claude', () => ({
  designerAiConfigured: vi.fn(() => true),
  parseProfileWithClaude: vi.fn(async () => ({ heritage: [], teams: [], music: [], events: [], family: [], favoriteTrips: [], interests: [], food: [], summary: '' })),
  curateItineraryWithClaude: vi.fn(async () => ({ days: [] })),
}));

import { parseProfileWithClaude } from '@/lib/designer/server/claude';
import { resetDailyBudgetsForTests } from '@/lib/designer/server/dailyBudget';
import { resetDesignerLimitsForTests } from '@/lib/designer/server/guard';
import { memberDailyCap } from '@/lib/designer/server/memberShare';
import { resetNamedPoolsForTests } from '@/lib/designer/server/sharedBudget';
import { POST as postBasket } from '../designer/basket/route';
import { POST as postItinerary } from '../designer/itinerary/route';
import { POST as postProfile } from '../designer/profile/route';
import { POST as postRoute } from '../designer/route-trip/route';
import { POST as postVoice } from '../voice/session/route';

// A fresh address per request: the per-client limiter isn't what stops these.
let ip = 0;
function request(path: string, body: unknown) {
  ip += 1;
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', 'Sec-Fetch-Site': 'same-origin', 'x-vercel-forwarded-for': `203.0.113.${ip % 250}` },
    body: JSON.stringify(body),
  });
}

const OFFER = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n';
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () =>
    new Response(JSON.stringify({ session: { id: 'live_test123' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer\r\n' } }), { status: 201 }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  fetchMock.mockReset();
  vi.mocked(parseProfileWithClaude).mockClear();
  resetDesignerLimitsForTests();
  resetDailyBudgetsForTests();
  resetNamedPoolsForTests();
});

describe('member daily share caps', () => {
  it('default to a fifth of the site cap, never fewer than a few, and follow their env vars', () => {
    expect(memberDailyCap('voice')).toBe(12);
    expect(memberDailyCap('designerAi')).toBe(30);
    expect(memberDailyCap('jev')).toBe(80);
    vi.stubEnv('VOICE_DAILY_SESSIONS', '5');
    expect(memberDailyCap('voice')).toBe(3);
    vi.stubEnv('VOICE_MEMBER_DAILY_SESSIONS', '7');
    expect(memberDailyCap('voice')).toBe(7);
    vi.stubEnv('VOICE_MEMBER_DAILY_SESSIONS', 'nonsense');
    expect(memberDailyCap('voice')).toBe(3);
  });
});

describe('voice: one member can’t use up everyone’s sessions', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test');
    vi.stubEnv('VOICE_ENABLED', '1');
  });

  it('refuses past the member’s share with a plain 429, before calling OpenAI', async () => {
    vi.stubEnv('VOICE_MEMBER_DAILY_SESSIONS', '2');
    expect((await postVoice(request('/api/voice/session', { sdp: OFFER }))).status).toBe(200);
    expect((await postVoice(request('/api/voice/session', { sdp: OFFER }))).status).toBe(200);
    const calls = fetchMock.mock.calls.length;
    const refused = await postVoice(request('/api/voice/session', { sdp: OFFER }));
    expect(refused.status).toBe(429);
    const body = await refused.json();
    expect(body.code).toBe('VOICE_MEMBER_DAILY_LIMIT');
    expect(body.error).toMatch(/your voice sessions for today/);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('gives the member’s share back when the site pool is what said no', async () => {
    vi.stubEnv('VOICE_MEMBER_DAILY_SESSIONS', '1');
    vi.stubEnv('VOICE_DAILY_SESSIONS', '0');
    const site = await postVoice(request('/api/voice/session', { sdp: OFFER }));
    expect(site.status).toBe(503);
    expect((await site.json()).code).toBe('VOICE_DAILY_LIMIT');
    vi.stubEnv('VOICE_DAILY_SESSIONS', '60');
    expect((await postVoice(request('/api/voice/session', { sdp: OFFER }))).status).toBe(200);
    expect((await postVoice(request('/api/voice/session', { sdp: OFFER }))).status).toBe(429);
  });
});

describe('designer AI: the member’s share, then the device', () => {
  const trip = { destination: 'st-moritz', startDate: '2027-02-06', nights: 3, participants: [{ name: 'Matt', kind: 'adult' }] };

  it('sorts a profile on the device and says it is this member’s share for today', async () => {
    vi.stubEnv('DESIGNER_AI_MEMBER_DAILY_CALLS', '1');
    const transcript = 'Braves fan from Atlanta, love it.';
    expect((await (await postProfile(request('/api/designer/profile', { transcript }))).json()).engine).toBe('claude');
    const second = await (await postProfile(request('/api/designer/profile', { transcript }))).json();
    expect(second.engine).toBe('on-device');
    expect(second.notice).toMatch(/your AI sorting for today/);
    expect(parseProfileWithClaude).toHaveBeenCalledTimes(1);
  });

  it('shares one designer AI allowance between the profile and the itinerary', async () => {
    vi.stubEnv('DESIGNER_AI_MEMBER_DAILY_CALLS', '1');
    await postProfile(request('/api/designer/profile', { transcript: 'Braves fan from Atlanta, love it.' }));
    const body = await (await postItinerary(request('/api/designer/itinerary', trip))).json();
    expect(body.itinerary.engine).toBe('on-device');
    expect(body.notice).toMatch(/your AI designer drafts for today/);
  });
});

describe('Jev: the member’s share, then word rules or ratings', () => {
  const candidates = [
    { id: 'a', name: 'Sushi Place', kind: 'food', rating: 4.9, source: 'Google Maps' },
    { id: 'b', name: 'Grill', kind: 'food', rating: 4.5, source: 'Yelp' },
  ];

  beforeEach(() => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test');
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ model: 'jev-latest', answers: {} }), { status: 200 }));
  });

  it('answers route-trip with word rules once the member’s share is used', async () => {
    vi.stubEnv('JEV_MEMBER_DAILY_CALLS', '1');
    await postRoute(request('/api/designer/route-trip', { text: 'somewhere warm', today: '2026-09-25' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = await (await postRoute(request('/api/designer/route-trip', { text: 'somewhere warm', today: '2026-09-25' }))).json();
    expect(body.decidedBy).toBe('rules');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ranks the basket by rating and says it is the member’s share for today', async () => {
    vi.stubEnv('JEV_MEMBER_DAILY_CALLS', '1');
    await postBasket(request('/api/designer/basket', { trip: { place: 'Tokyo' }, candidates }));
    const calls = fetchMock.mock.calls.length;
    const body = await (await postBasket(request('/api/designer/basket', { trip: { place: 'Tokyo' }, candidates }))).json();
    expect(body.rankedBy).toBe('rating');
    expect(body.note).toMatch(/your fit checks for today/);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });
});
