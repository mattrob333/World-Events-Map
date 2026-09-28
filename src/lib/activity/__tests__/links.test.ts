import { describe, expect, it } from 'vitest';
import type { Activity } from '../activities';
import { bookIt, cleanHashtags, formatAirports, httpsUrl, localTimeIn, moreInfo, seeIt, travelWindow } from '../links';

function spot(over: Partial<Activity> = {}): Activity {
  return {
    id: 'vail-skiing-us', name: 'Vail skiing', place: 'Vail', country: 'United States', countryCode: 'US', region: 'Americas',
    lat: 39.6061, lng: -106.355, category: 'ski', kind: 'place', bestMonths: [12, 1, 2, 3], peakMonths: [1, 2],
    summary: 'Big mountain skiing.', tags: [], heat: null, conditions: 'snow', sources: [], ...over,
  };
}

/** Every URL-looking string a builder returns parses and is https. */
function allHttps(obj: unknown): void {
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) return;
      expect(new URL(v).protocol, v).toBe('https:');
      expect(v).not.toMatch(/\s/);
    } else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(obj);
}

// Sunday 27 September 2026, noon local.
const NOW = new Date(2026, 8, 27, 12);

describe('httpsUrl and hashtags', () => {
  it('accepts only absolute https URLs with a real host', () => {
    expect(httpsUrl('https://www.vail.com/')).toBe('https://www.vail.com/');
    expect(httpsUrl('  https://www.vail.com/  ')).toBe('https://www.vail.com/');
    expect(httpsUrl('http://www.vail.com/')).toBeUndefined();
    expect(httpsUrl('javascript:alert(1)')).toBeUndefined();
    expect(httpsUrl('//vail.com')).toBeUndefined();
    expect(httpsUrl('https://localhost/')).toBeUndefined();
    expect(httpsUrl('https://www.vail.com/a b')).toBeUndefined();
    expect(httpsUrl('')).toBeUndefined();
    expect(httpsUrl(undefined)).toBeUndefined();
    expect(httpsUrl(null)).toBeUndefined();
  });

  it('cleans hashtags', () => {
    expect(cleanHashtags(['#vail', 'vail', 'Vail Resorts', 'skiing_co', 'niseko雪', '', '#'])).toEqual(['vail', 'skiing_co', 'niseko雪']);
    expect(cleanHashtags(undefined)).toEqual([]);
  });
});

describe('seeIt', () => {
  it('prefers official accounts', () => {
    const links = seeIt(spot({
      hashtags: ['vail'],
      links: { instagram: 'https://www.instagram.com/vailmtn/', tiktok: 'https://www.tiktok.com/@vailmtn', youtube: 'https://www.youtube.com/@vailmtn' },
    }));
    expect(links).toEqual({
      instagram: { url: 'https://www.instagram.com/vailmtn/', official: true },
      tiktok: { url: 'https://www.tiktok.com/@vailmtn', official: true },
      youtube: { url: 'https://www.youtube.com/@vailmtn', official: true },
    });
    allHttps(links);
  });

  it('falls back to the first hashtag and a YouTube search', () => {
    const links = seeIt(spot({ hashtags: ['#vailmountain', 'vail'] }));
    expect(links.instagram).toEqual({ url: 'https://www.instagram.com/explore/tags/vailmountain/', official: false });
    expect(links.tiktok).toEqual({ url: 'https://www.tiktok.com/tag/vailmountain', official: false });
    expect(links.youtube).toEqual({ url: 'https://www.youtube.com/results?search_query=Vail+skiing+Vail', official: false });
  });

  it('encodes non-ASCII tags and names', () => {
    const links = seeIt(spot({ name: 'Fête des Lumières', place: 'Lyon', hashtags: ['fêtedeslumières'] }));
    expect(links.instagram?.url).toBe('https://www.instagram.com/explore/tags/f%C3%AAtedeslumi%C3%A8res/');
    expect(links.youtube?.url).toBe('https://www.youtube.com/results?search_query=F%C3%AAte+des+Lumi%C3%A8res+Lyon');
    allHttps(links);
  });

  it('leaves Instagram and TikTok out without a hashtag, and ignores unsafe official links', () => {
    const links = seeIt(spot({ links: { instagram: 'http://instagram.com/x', tiktok: 'javascript:void(0)' } }));
    expect(links.instagram).toBeUndefined();
    expect(links.tiktok).toBeUndefined();
    expect(links.youtube?.official).toBe(false);
    // An unsafe official link falls back to the hashtag page when there is one.
    expect(seeIt(spot({ hashtags: ['vail'], links: { instagram: 'http://instagram.com/x' } })).instagram?.official).toBe(false);
    expect(seeIt(spot({ name: '', place: '' })).youtube).toBeUndefined();
  });
});

describe('travelWindow', () => {
  it('uses a week from the first Saturday of the selected month', () => {
    // December 2026: the 1st is a Tuesday, the first Saturday is the 5th.
    expect(travelWindow(spot(), 12, NOW)).toEqual({ start: '2026-12-05', end: '2026-12-12' });
    // August is behind us in September 2026, so the next August: 1 Aug 2027 is a Sunday, Saturday is the 7th.
    expect(travelWindow(spot(), 8, NOW)).toEqual({ start: '2027-08-07', end: '2027-08-14' });
    // A month that starts on a Saturday: May 2027.
    expect(travelWindow(spot(), 5, NOW)).toEqual({ start: '2027-05-01', end: '2027-05-08' });
  });

  it('for "now" and the current month, starts on the next Saturday from today', () => {
    expect(travelWindow(spot(), 'now', NOW)).toEqual({ start: '2026-10-03', end: '2026-10-10' });
    expect(travelWindow(spot(), 9, NOW)).toEqual({ start: '2026-10-03', end: '2026-10-10' });
    const saturday = new Date(2026, 9, 3, 9);
    expect(travelWindow(spot(), 'now', saturday)).toEqual({ start: '2026-10-03', end: '2026-10-10' });
  });

  it('uses an event\'s own dates until it has ended', () => {
    const ev = spot({ kind: 'event', eventDates: { start: '2026-12-04', end: '2026-12-11', status: 'confirmed', sourceUrl: 'https://example.com/' } });
    expect(travelWindow(ev, 3, NOW)).toEqual({ start: '2026-12-04', end: '2026-12-11' });
    const past = spot({ kind: 'event', eventDates: { start: '2026-06-01', end: '2026-06-03', status: 'confirmed', sourceUrl: 'https://example.com/' } });
    expect(travelWindow(past, 12, NOW)).toEqual({ start: '2026-12-05', end: '2026-12-12' });
  });
});

describe('bookIt', () => {
  const vail = spot({
    nearestAirports: [{ iata: 'EGE', city: 'Eagle', driveTime: '35 min' }, { iata: 'DEN', city: 'Denver', driveTime: '2 h' }],
    links: { tickets: 'https://www.epicpass.com/' },
    bookAheadNote: '  Lift tickets are cheaper bought ahead. ',
  });

  it('builds flights from the home airport to the nearest airport, with dates', () => {
    const b = bookIt(vail, { homeAirport: 'atl', month: 12, now: NOW });
    expect(b.flights).toBe(
      'https://www.google.com/travel/flights?q=' + encodeURIComponent('Flights from ATL to EGE on 2026-12-05 through 2026-12-12'),
    );
    expect(decodeURIComponent(b.flights!.split('q=')[1])).toBe('Flights from ATL to EGE on 2026-12-05 through 2026-12-12');
    expect(b.stay).toBe('https://www.booking.com/searchresults.html?ss=Vail%2C+United+States&checkin=2026-12-05&checkout=2026-12-12');
    expect(b.tickets).toBe('https://www.epicpass.com/');
    expect(b.bookAheadNote).toBe('Lift tickets are cheaper bought ahead.');
    expect(b.airports).toBe('EGE 35 min, DEN 2 h');
    expect(b.dates).toEqual({ start: '2026-12-05', end: '2026-12-12' });
    allHttps(b);
  });

  it('without a home airport, or with a junk one, asks for flights to the destination', () => {
    for (const homeAirport of [undefined, '', 'Atlanta', 'A1C']) {
      const b = bookIt(vail, { homeAirport, month: 12, now: NOW });
      expect(decodeURIComponent(b.flights!.split('q=')[1])).toBe('Flights to EGE on 2026-12-05 through 2026-12-12');
    }
  });

  it('falls back to "place, country" without listed airports', () => {
    const b = bookIt(spot(), { month: 12, now: NOW });
    expect(decodeURIComponent(b.flights!.split('q=')[1])).toBe('Flights to Vail, United States on 2026-12-05 through 2026-12-12');
    expect(b.airports).toBeUndefined();
    expect(b.tickets).toBeUndefined();
    expect(b.bookAheadNote).toBeUndefined();
  });

  it('uses event dates and the profile ticket URL', () => {
    const ev = spot({
      kind: 'event', ticketUrl: 'https://www.ticketmaster.com/event/123',
      eventDates: { start: '2026-12-04', end: '2026-12-06', status: 'confirmed', sourceUrl: 'https://example.com/' },
      nearestAirports: [{ iata: 'DEN', city: 'Denver' }],
    });
    const b = bookIt(ev, { homeAirport: 'ATL', month: 'now', now: NOW });
    expect(decodeURIComponent(b.flights!.split('q=')[1])).toBe('Flights from ATL to DEN on 2026-12-04 through 2026-12-06');
    expect(b.tickets).toBe('https://www.ticketmaster.com/event/123');
    expect(b.airports).toBe('DEN');
  });

  it('skips unsafe ticket links and bad airport codes', () => {
    const b = bookIt(spot({
      links: { tickets: 'http://tickets.example.com' }, ticketUrl: 'ftp://x',
      nearestAirports: [{ iata: 'XX', city: 'Nowhere' }, { iata: 'eGe', city: 'Eagle' }],
    }), { month: 12, now: NOW });
    expect(b.tickets).toBeUndefined();
    expect(b.airports).toBe('EGE');
    expect(decodeURIComponent(b.flights!.split('q=')[1])).toContain('to EGE');
  });

  it('does not search flights from an airport to itself', () => {
    const b = bookIt(vail, { homeAirport: 'EGE', month: 12, now: NOW });
    expect(b.flights).toBeUndefined();
    expect(b.stay).toBeDefined();
  });

  it('builds nothing without a place, country or airport', () => {
    const b = bookIt(spot({ place: '', country: '' }), { month: 12, now: NOW });
    expect(b.flights).toBeUndefined();
    expect(b.stay).toBeUndefined();
    expect(b.dates).toBeUndefined();
  });

  it('formats airports', () => {
    expect(formatAirports([{ iata: 'EGE', city: 'Eagle', driveTime: '35 min' }, { iata: 'DEN', city: 'Denver' }])).toBe('EGE 35 min, DEN');
    expect(formatAirports([])).toBeUndefined();
    expect(formatAirports(undefined)).toBeUndefined();
  });
});

describe('moreInfo', () => {
  it('builds official, directions, Wikipedia and weather links', () => {
    const m = moreInfo(spot({
      links: { officialSite: 'https://www.vail.com/' },
      hashtags: ['#vail', 'vailmountain'],
    }), NOW);
    expect(m.officialSite).toBe('https://www.vail.com/');
    expect(m.directions).toBe('https://www.google.com/maps/dir/?api=1&destination=39.6061,-106.355');
    expect(m.weather).toBe('https://weather.com/weather/today/l/39.61,-106.36');
    expect(m.wikipedia).toBeUndefined();
    expect(m.localTime).toBeUndefined();
    expect(m.hashtags).toEqual(['vail', 'vailmountain']);
    allHttps(m);
  });

  it('takes Wikipedia from links, else the first English Wikipedia source', () => {
    const sources = ['https://www.vail.com/', 'https://de.wikipedia.org/wiki/Vail', 'https://en.wikipedia.org/wiki/Vail_Ski_Resort', 'https://en.wikipedia.org/wiki/Vail'];
    expect(moreInfo(spot({ sources }), NOW).wikipedia).toBe('https://en.wikipedia.org/wiki/Vail_Ski_Resort');
    expect(moreInfo(spot({ sources, links: { wikipedia: 'https://en.wikipedia.org/wiki/Vail,_Colorado' } }), NOW).wikipedia)
      .toBe('https://en.wikipedia.org/wiki/Vail,_Colorado');
    expect(moreInfo(spot({ sources: ['http://en.wikipedia.org/wiki/Vail'] }), NOW).wikipedia).toBeUndefined();
  });

  it('gives local time only for a known time zone', () => {
    const at = new Date('2026-09-27T18:05:00Z');
    expect(moreInfo(spot(), at, { tz: 'America/Denver' }).localTime).toBe('12:05 PM');
    expect(localTimeIn('Asia/Tokyo', at)).toBe('3:05 AM');
    expect(localTimeIn('Not/AZone', at)).toBeUndefined();
    expect(localTimeIn(undefined, at)).toBeUndefined();
  });

  it('omits map links for bad coordinates and empty hashtags', () => {
    const m = moreInfo(spot({ lat: Number.NaN, lng: 200 }), NOW);
    expect(m.directions).toBeUndefined();
    expect(m.weather).toBeUndefined();
    expect(m.hashtags).toBeUndefined();
    expect(m.officialSite).toBeUndefined();
  });
});
