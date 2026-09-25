import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { emptyProfile } from '@/lib/designer/profile';
import { wheresIn } from '@/lib/geo/regions';
import { readTrip } from '@/lib/voice/tripBrief';
import { withTaste } from './affinity';
import { placeMatcher } from './extract';
import { vibeMatch, type Mention } from './match';
import { placeIndex } from './places';
import { tripWindow } from './window';

const TODAY = '2026-09-25';
const places = placeIndex(EVENTS);
const alpsAsk = "I want to go on a ski trip in the Alps, the coolest place, my family of four and another family of four, the first week in February.";

function run(text: string, mentions: Map<string, Mention[]> | null = null) {
  const brief = readTrip(text, TODAY);
  const window = tripWindow(brief.when, TODAY);
  return { window, result: vibeMatch({ wheres: brief.wheres, tripType: brief.tripType, window, today: TODAY, events: EVENTS, places, mentions, news: { state: mentions ? 'ok' : 'unavailable', since: '2026-09-25T04:40:00Z', stories: 10 } }) };
}

describe('trip window', () => {
  it('uses the exact week when one was said, else the month', () => {
    expect(tripWindow({ start: '2027-02-01', nights: 7 }, TODAY)).toMatchObject({ from: '2027-02-01', to: '2027-02-08', exact: true });
    expect(tripWindow({ start: '2026-11-01', month: { from: '2026-11-01', to: '2026-11-31' } }, TODAY)).toMatchObject({ from: '2026-11-01', to: '2026-11-30', exact: false });
    expect(tripWindow({}, TODAY)).toMatchObject({ from: TODAY, exact: false });
  });
});

describe('reading places in stories', () => {
  const match = placeMatcher(places);
  it('finds resorts by name and alias, ignoring accents', () => {
    expect(match('Snow returns early to St Moritz and Kitzbuhel')).toEqual(expect.arrayContaining(['resort:switzerland:st-moritz', 'resort:austria:kitzbuhel']));
    expect(match("Val d'Isère opens its season")).toContain('resort:france:val-d-isere');
  });
  it('never credits a whole ski area to one resort, and ambiguous words need their country', () => {
    expect(match('The 3 Vallées announce a new lift pass')).toEqual([]);
    expect(match('We had a nice time')).toEqual([]);
  });
});

describe('Vibe Match', () => {
  it('ranks Alpine ski places for the first week of February, never Paris or Vienna', () => {
    const { window, result } = run(alpsAsk);
    expect(window).toMatchObject({ from: '2027-02-01', to: '2027-02-08', exact: true });
    expect(result.places.length).toBeGreaterThan(0);
    expect(result.places[0]!.name).toBe('St. Moritz');
    for (const place of result.places) expect(['Switzerland', 'France', 'Austria', 'Italy', 'Germany', 'Slovenia', 'Liechtenstein']).toContain(place.country);
    expect(result.places.some((place) => place.name === 'Paris' || place.name === 'Vienna')).toBe(false);
    // Resorts with nothing dated or counted are listed, not ranked.
    expect(result.alsoInRange.map((place) => place.name)).toContain('Zermatt');
  });

  it('gives every reason a source and adds up its components', () => {
    const { result } = run(alpsAsk);
    for (const place of result.places) {
      for (const reason of place.reasons) expect(reason.sources.length).toBeGreaterThan(0);
      const { calendar, news, prior } = place.components;
      expect(Math.abs(calendar + news + prior - place.points)).toBeLessThan(0.11);
    }
  });

  it('counts news mentions, at most two per source, and says how many', () => {
    const story = (source: string, n: number): Mention => ({ title: `Zermatt story ${n}`, url: `https://example.com/${source}/${n}`, source, tier: 'A', publishedAt: '2026-09-24T10:00:00Z' });
    const mentions = new Map([['resort:switzerland:zermatt', [story('A', 1), story('A', 2), story('A', 3), story('B', 1)]]]);
    const zermatt = run(alpsAsk, mentions).result.places.find((place) => place.name === 'Zermatt')!;
    expect(zermatt.mentionCount).toBe(3);
    expect(zermatt.sourceCount).toBe(2);
    expect(zermatt.reasons.find((reason) => reason.kind === 'news')?.text).toBe('Named in 3 stories from 2 sources since Sep 25');
  });

  it('adds taste on the device: a wine lover gets the culinary week, quoted', () => {
    const { result } = run('somewhere with great food in mid November');
    const plain = withTaste(result.places, undefined);
    const wine = withTaste(result.places, { ...emptyProfile(), food: ['wine'] });
    expect(plain.every((place) => place.taste === 0 && !place.personalized)).toBe(true);
    const tasted = wine.find((place) => place.taste > 0);
    if (tasted) expect(tasted.reasons[0]!.text).toMatch(/^Matches your wine/);
  });

  it('keeps the scope to a named country', () => {
    const { result } = run('Japan, the last week of March, pack in as many cool things as I can');
    for (const place of result.places) expect(place.country).toBe('Japan');
  });
});

it('reads "the Alps" as a region', () => {
  expect(wheresIn('the Alps')[0]?.label).toBe('the Alps');
});
