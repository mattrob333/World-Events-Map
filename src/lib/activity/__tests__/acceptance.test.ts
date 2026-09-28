import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../activities';
import { bookIt, moreInfo } from '../links';
import { formatMonthRanges, isInSeason, verdict } from '../season';
import { validateActivities } from '../validate';

const TODAY = new Date(2026, 8, 27); // Sep 27 2026
const get = (id: string) => {
  const a = ACTIVITIES.find((x) => x.id === id);
  if (!a) throw new Error(`missing ${id}`);
  return a;
};

describe('activity acceptance', () => {
  it('Aspen in October: Opens in about 8 weeks. Best Dec to Mar', () => {
    const v = verdict(get('aspen-snowmass-us'), 10, TODAY);
    expect(v.text).toBe('Opens in about 8 weeks. Best Dec to Mar');
    expect(v.tone).not.toBe('good');
  });

  it('July: Alps ski is out of season; Chile, Argentina and New Zealand ski are in', () => {
    const ski = ACTIVITIES.filter((a) => a.category === 'ski');
    for (const cc of ['FR', 'CH', 'AT', 'IT']) {
      for (const a of ski.filter((x) => x.countryCode === cc)) expect(isInSeason(a, 7, TODAY), a.id).toBe(false);
    }
    for (const cc of ['CL', 'AR', 'NZ']) {
      const list = ski.filter((x) => x.countryCode === cc);
      expect(list.length, cc).toBeGreaterThan(0);
      for (const a of list) expect(isInSeason(a, 7, TODAY), a.id).toBe(true);
    }
  });

  it('Aspen has flights to its airports, a stay, lift passes and the official site', () => {
    const aspen = get('aspen-snowmass-us');
    const codes = (aspen.nearestAirports ?? []).map((a) => a.iata);
    expect(codes).toEqual(expect.arrayContaining(['ASE', 'EGE']));
    const book = bookIt(aspen, { homeAirport: 'ATL', month: 12, now: TODAY });
    expect(book.flights).toMatch(/^https:\/\/www\.google\.com\/travel\/flights/);
    expect(decodeURIComponent(book.flights!)).toContain('from ATL to ASE');
    expect(book.stay).toMatch(/^https:\/\/www\.booking\.com\//);
    expect(book.tickets).toMatch(/^https:\/\/www\.aspensnowmass\.com\//);
    expect(book.airports).toContain('EGE');
    const info = moreInfo(aspen, TODAY, { tz: aspen.tz });
    expect(info.officialSite).toBe('https://www.aspensnowmass.com');
    expect(info.localTime).toBeTruthy();
    expect(info.hashtags?.length).toBeGreaterThan(0);
  });

  it('verdicts never read as bad and only use the three calm tones', () => {
    for (const a of ACTIVITIES) {
      for (const m of ['now', 1, 4, 7, 10] as const) {
        const v = verdict(a, m, TODAY);
        expect(v.text, a.id).not.toMatch(/bad/i);
        expect(['good', 'season', 'off']).toContain(v.tone);
      }
    }
  });

  it("formats an event verdict as 'Oct 31 to Nov 2. 5 weeks away'", () => {
    const ev = {
      ...get('aspen-snowmass-us'),
      kind: 'event' as const,
      eventDates: { start: '2026-10-31', end: '2026-11-02', status: 'confirmed' as const, sourceUrl: 'https://example.org' },
    };
    expect(verdict(ev, 'now', TODAY).text).toBe('Oct 31 to Nov 2. 5 weeks away');
  });

  it('wraps and compresses month ranges', () => {
    expect(formatMonthRanges([12, 1, 2, 3])).toBe('Dec to Mar');
    expect(formatMonthRanges([3, 4, 5, 9, 10, 11])).toBe('Mar to May and Sep to Nov');
    expect(formatMonthRanges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('all year');
  });

  it('passes the dataset schema check', () => {
    expect(validateActivities(ACTIVITIES).errors).toEqual([]);
  });

  it('has at least 3 spots in every country', () => {
    const by = new Map<string, number>();
    for (const a of ACTIVITIES) by.set(a.countryCode, (by.get(a.countryCode) ?? 0) + 1);
    const thin = [...by].filter(([cc, n]) => n < 3 && cc !== 'MY');
    expect(thin).toEqual([]);
  });
});

describe('activity data fixes', () => {
  it('moves the 2026 Bahrain Grand Prix to Sepang and keeps the Sakhir id for 2027', () => {
    const my = get('bahrain-grand-prix-my');
    expect(my.countryCode).toBe('MY');
    expect(my.eventDates?.start).toBe('2026-10-02');
    expect(my.note).toMatch(/Sepang/);
    const bh = get('bahrain-grand-prix-bh');
    expect(bh.countryCode).toBe('BH');
    expect(bh.eventDates?.start).toBe('2027-03-12');
  });

  it("shows 'Date under review' for Qatar and Abu Dhabi 2026", () => {
    for (const id of ['qatar-grand-prix-qa', 'abu-dhabi-grand-prix-ae']) {
      const a = get(id);
      expect(a.eventDates?.status).toBe('under-review');
      expect(verdict(a, 'now', TODAY).text).toMatch(/^Date under review/);
    }
  });

  it('explains the events with no dates instead of guessing them', () => {
    for (const id of ['esala-perahera-lk', 'heiva-i-tahiti-pf']) {
      const a = get(id);
      expect(a.eventDates ?? null).toBeNull();
      expect(verdict(a, 'now', TODAY).text).toBe(a.datesNote);
    }
  });

  it('gives every record a heat and a time zone', () => {
    for (const a of ACTIVITIES) {
      expect(a.heat, a.id).not.toBeNull();
      expect(a.tz, a.id).toBeTruthy();
    }
  });
});

describe('activity UI copy', () => {
  it('has no em dashes or emoji in the activity components and data', () => {
    const root = join(__dirname, '../../..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(tsx?|json|css)$/.test(f)) files.push(p);
      }
    };
    walk(join(root, 'components/activity'));
    walk(join(root, 'data/activities'));
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      expect(text.includes('—'), `em dash in ${f}`).toBe(false);
      expect(emoji.test(text), `emoji in ${f}`).toBe(false);
    }
  });
});
