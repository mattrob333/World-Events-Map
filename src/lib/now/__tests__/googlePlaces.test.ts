import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { takeShared } = vi.hoisted(() => ({ takeShared: vi.fn(async () => true) }));
vi.mock('@/lib/designer/server/sharedBudget', () => ({ takeShared, takeSharedNamed: vi.fn(async () => true), refundSharedNamed: vi.fn(async () => undefined) }));

const { withGoogleHours, sameName } = await import('../googlePlaces');
import type { PulseVenue } from '../pulse';
import { buildTonight } from '../tonight';

/** A member's share: `left` units, counting what was taken and given back. */
const share = (left: number) => {
  const state = { left, taken: 0, refunded: 0 };
  return { state, take: vi.fn(async () => (state.left > 0 ? (state.left -= 1, state.taken += 1, true) : false)), refund: vi.fn(async () => { state.left += 1; state.refunded += 1; }) };
};

const venue = (id: string, extra: Partial<PulseVenue> = {}): PulseVenue => ({ id, name: id, category: 'BAR', lat: 41.26, lng: -95.93, busyness: 50, basis: 'forecast', ...extra });
// Friday 22:00 in Omaha = Saturday 03:00 UTC.
const NOW = new Date('2026-09-26T03:00:00Z');

describe('withGoogleHours', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('fills tonight’s close where BestTime had none, keeps BestTime’s own, and drops places closed now', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).textQuery as string;
      const periods = query.startsWith('closed-now')
        ? [{ open: { day: 5, hour: 11, minute: 0 }, close: { day: 5, hour: 21, minute: 0 } }]
        : [{ open: { day: 5, hour: 16, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }];
      return new Response(JSON.stringify({ places: [{ businessStatus: 'OPERATIONAL', displayName: { text: query.split(',')[0] }, currentOpeningHours: { periods }, utcOffsetMinutes: -300, googleMapsUri: 'https://maps.google.com/?cid=1' }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const out = await withGoogleHours([venue('has-hours', { closesMinutes: 1500 }), venue('open-late'), venue('closed-now')], NOW);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(out.map((v) => [v.id, v.closesMinutes, v.hoursFrom])).toEqual([['has-hours', 1500, 'besttime'], ['open-late', 1560, 'google']]);
    expect(out[1].mapsUrl).toBe('https://maps.google.com/?cid=1');
  });

  it('drops places Google lists as temporarily or permanently closed, even with BestTime hours', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).textQuery as string;
      const businessStatus = query.startsWith('shut-temp') ? 'CLOSED_TEMPORARILY' : query.startsWith('shut-gone') ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL';
      return new Response(JSON.stringify({ places: [{ businessStatus, displayName: { text: query.split(',')[0] } }] }));
    }));
    const out = await withGoogleHours([venue('shut-temp', { closesMinutes: 1500, busyness: 100 }), venue('shut-gone'), venue('fine-1')], NOW);
    expect(out.map((v) => v.id)).toEqual(['fine-1']);
  });

  it('keeps a place when Google’s listing is another business, or BestTime reads it live', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).textQuery as string;
      const name = query.startsWith('other-name') ? 'Old Shoe Store' : query.split(',')[0];
      return new Response(JSON.stringify({ places: [{ businessStatus: 'CLOSED_PERMANENTLY', displayName: { text: name } }] }));
    }));
    const out = await withGoogleHours([venue('other-name'), venue('live-now', { basis: 'live' })], NOW);
    expect(out.map((v) => v.id)).toEqual(['other-name', 'live-now']);
  });

  it('checks only the busiest fifteen', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ places: [] })));
    vi.stubGlobal('fetch', fetchMock);
    const many = Array.from({ length: 20 }, (_, i) => venue(`many-${i}`, { busyness: 100 - i }));
    const out = await withGoogleHours(many, NOW);
    expect(fetchMock).toHaveBeenCalledTimes(15);
    expect(out).toHaveLength(20);
  });

  it('without a key it only marks BestTime hours', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const out = await withGoogleHours([venue('a', { closesMinutes: 1500 }), venue('b')], NOW);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(out.map((v) => v.hoursFrom)).toEqual(['besttime', undefined]);
  });
});

describe('placeDetails', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('keeps only what Google returned, cleaned', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ places: [{
      primaryTypeDisplayName: { text: 'Cocktail bar' }, rating: 4.63, userRatingCount: 1203, priceLevel: 'PRICE_LEVEL_MODERATE',
      websiteUri: 'javascript:alert(1)', nationalPhoneNumber: '(402) 555-0100<script>', googleMapsUri: 'https://maps.google.com/?cid=9',
      currentOpeningHours: { periods: [{ open: { day: 5, hour: 16, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }] }, utcOffsetMinutes: -300,
    }] }))));
    const { place: details } = await placeDetails({ id: 'details-1', name: 'Proof', lat: 41.26, lng: -95.93 }, NOW);
    expect(details).toEqual({ type: 'Cocktail bar', rating: 4.6, ratingCount: 1203, price: '$$', phone: '(402) 555-0100', mapsUrl: 'https://maps.google.com/?cid=9', closesMinutes: 1560 });
  });

  it('says when Google lists a place closed, and gives today’s hours and the address', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    const week = ['Monday: Closed', 'Tuesday: Closed', 'Wednesday: 4:00 PM – 11:00 PM', 'Thursday: 4:00 PM – 11:00 PM', 'Friday: 4:00 PM – 2:00 AM', 'Saturday: 12:00 PM – 2:00 AM', 'Sunday: 12:00 PM – 9:00 PM'];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ places: [{
      businessStatus: 'CLOSED_TEMPORARILY', displayName: { text: 'Site 1 Brewing' }, formattedAddress: '1500 Harney St, Omaha, NE 68102, USA',
      regularOpeningHours: { weekdayDescriptions: week, periods: [{ open: { day: 5, hour: 16, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }] }, utcOffsetMinutes: -300,
    }] }))));
    const { place: details } = await placeDetails({ id: 'details-3', name: 'Site-1 Brewing', lat: 41.26, lng: -95.93 }, NOW);
    expect(details).toMatchObject({ shut: 'temporarily', address: '1500 Harney St, Omaha, NE 68102, USA', hoursToday: '4:00 PM – 2:00 AM', hoursTodayUsual: true });
  });

  it('prefers this week’s hours (a holiday) over the regular week', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    const regular = ['Monday: Closed', 'Tuesday: Closed', 'Wednesday: Closed', 'Thursday: Closed', 'Friday: 4:00 PM – 2:00 AM', 'Saturday: Closed', 'Sunday: Closed'];
    const current = regular.map((line) => (line.startsWith('Friday') ? 'Friday: Closed' : line));
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ places: [{
      displayName: { text: 'Holiday Bar' }, currentOpeningHours: { weekdayDescriptions: current, periods: [] }, regularOpeningHours: { weekdayDescriptions: regular }, utcOffsetMinutes: -300,
    }] }))));
    const { place: details } = await placeDetails({ id: 'details-4', name: 'Holiday Bar', lat: 41.26, lng: -95.93 }, NOW);
    expect(details).toMatchObject({ hoursToday: 'Closed', closedNow: true });
    expect(details?.hoursTodayUsual).toBeUndefined();
  });

  it('says nothing without a key', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    const { placeDetails } = await import('../googlePlaces');
    expect(await placeDetails({ id: 'details-2', name: 'Proof', lat: 41.26, lng: -95.93 })).toEqual({ place: null, reason: 'unavailable' });
  });
});

describe('lookup budget and failures', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('asks the member’s share first, and a failure is retried rather than hidden for 12 hours', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    const refuse = share(0);
    const fetchMock = vi.fn(async () => new Response('down', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await placeDetails({ id: 'budget-1', name: 'X', lat: 1, lng: 1 }, NOW, refuse)).toEqual({ place: null, reason: 'budget' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await placeDetails({ id: 'budget-2', name: 'X', lat: 1, lng: 1 }, NOW)).toEqual({ place: null, reason: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ now: Date.now() + 6 * 60 * 1000 });
    await placeDetails({ id: 'budget-2', name: 'X', lat: 1, lng: 1 }, NOW);
    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives the member’s unit back when the site’s budget says no', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const mine = share(5);
    takeShared.mockImplementationOnce(async () => false);
    expect(await placeDetails({ id: 'site-cap-1', name: 'X', lat: 1, lng: 1 }, NOW, mine)).toEqual({ place: null, reason: 'budget' });
    expect(mine.state).toEqual({ left: 5, taken: 1, refunded: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says when Google had no listing', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ places: [] }))));
    expect(await placeDetails({ id: 'no-listing-1', name: 'X', lat: 1, lng: 1 }, NOW)).toEqual({ place: null, reason: 'none' });
  });

  it('shares one call among lookups of the same place at once, charged once', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const fetchMock = vi.fn(async () => { await gate; return new Response(JSON.stringify({ places: [{ displayName: { text: 'Proof' }, rating: 4.5 }] })); });
    vi.stubGlobal('fetch', fetchMock);
    takeShared.mockClear();
    const a = share(5);
    const b = share(5);
    const both = Promise.all([placeDetails({ id: 'dedupe-1', name: 'Proof', lat: 1, lng: 1 }, NOW, a), placeDetails({ id: 'dedupe-1', name: 'Proof', lat: 1, lng: 1 }, NOW, b)]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    const [first, second] = await both;
    expect(first.place?.rating).toBe(4.5);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.state.taken + b.state.taken).toBe(1);
    expect(takeShared).toHaveBeenCalledTimes(1);
  });

  it('a member out of their share doesn’t stop another member’s lookup running at the same time', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    const { placeDetails } = await import('../googlePlaces');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ places: [{ displayName: { text: 'Proof' }, rating: 4.2 }] })));
    vi.stubGlobal('fetch', fetchMock);
    const spent = share(0);
    const fresh = share(5);
    const [refused, served] = await Promise.all([placeDetails({ id: 'poison-1', name: 'Proof', lat: 1, lng: 1 }, NOW, spent), placeDetails({ id: 'poison-1', name: 'Proof', lat: 1, lng: 1 }, NOW, fresh)]);
    expect(refused).toEqual({ place: null, reason: 'budget' });
    expect(served.place?.rating).toBe(4.2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fresh.state.taken).toBe(1);
  });
});

describe('withGoogleHours for a member', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('charges the member’s share once per real lookup, never for remembered places', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ places: [] }))));
    const mine = share(10);
    await withGoogleHours([venue('charged-1'), venue('charged-2')], NOW, mine);
    expect(mine.state.taken).toBe(2);
    await withGoogleHours([venue('charged-1'), venue('charged-2')], NOW, mine);
    expect(mine.state.taken).toBe(2);
  });

  it('at 1am, a bar open till 2am is still on tonight’s timeline with an hour left', async () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).textQuery as string;
      return new Response(JSON.stringify({ places: [{ businessStatus: 'OPERATIONAL', displayName: { text: query.split(',')[0] }, currentOpeningHours: { periods: [{ open: { day: 5, hour: 16, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }] }, utcOffsetMinutes: -300 }] }));
    }));
    // Saturday 01:00 in Omaha = Saturday 06:00 UTC.
    const out = await withGoogleHours([venue('one-am-bar')], new Date('2026-09-26T06:00:00Z'));
    expect(out[0]).toMatchObject({ closesMinutes: 1560, hoursFrom: 'google' });
    const tonight = buildTonight(out, 60);
    expect(tonight.rows.map((row) => [row.venue.id, row.minutesLeft])).toEqual([['one-am-bar', 60]]);
  });
});

describe('sameName', () => {
  it('matches the same place written differently, not a different business', () => {
    expect(sameName('Site-1 Brewing', 'Site 1 Brewing')).toBe(true);
    expect(sameName('The Mercury', 'Mercury')).toBe(true);
    expect(sameName('Omaha Tap House', 'Tap House Omaha - Downtown')).toBe(true);
    expect(sameName('Mercury', 'Old Shoe Store')).toBe(false);
    expect(sameName('Blue Bar & Grill', 'Red Bar & Grill')).toBe(false);
    expect(sameName('Mercury', undefined)).toBe(false);
  });
});
