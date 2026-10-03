import { describe, expect, it } from 'vitest';
import type { Signal } from '@/lib/vibe/signals';
import { SKI_RANGES, SKI_RESORTS, SKI_SCENE } from '../data';
import { formatTicket, interestWeights, isForThem, matchResort, priceBand, rankRanges, rankResorts, rankWeeks } from '../match';
import { RANGES } from '../ranges';
import { decodePlan, decodeReply, encodePlan, encodeReply, newTripId, optionValid, type Level } from '../share';
import type { SceneItem, SkiResort } from '../types';
import { validateSki } from '../validate';
import { candidateWeeks, crowdWeeks, monthsLabel, monthWeights } from '../window';
import { standing } from '../store';
import { SPOT_RESORT } from '../spots';

const resort = (over: Partial<SkiResort> = {}): SkiResort => ({
  id: 'test-peak',
  name: 'Test Peak',
  rangeId: 'colorado',
  place: 'Testville',
  region: 'Colorado',
  country: 'United States',
  countryCode: 'US',
  lat: 39,
  lng: -106,
  season: { opensMonth: 11, closesMonth: 4, dates: null },
  bestMonths: [1, 2, 3],
  peakMonths: [2],
  topFt: 12000,
  verticalFt: 3000,
  skiableAcres: 2000,
  trails: 100,
  passes: ['ikon'],
  liftTicket: { currency: 'USD', low: 150, high: 250, season: '2026/27', sourceUrl: 'https://example.com/tickets', checkedOn: '2026-10-03' },
  vibe: ['apres'],
  summary: 'A test mountain',
  why: 'For tests.',
  links: { officialSite: 'https://example.com' },
  nearestAirports: [{ iata: 'DEN', city: 'Denver' }],
  sources: ['https://example.com'],
  ...over,
});

const item = (over: Partial<SceneItem>): SceneItem => ({
  id: 'test-peak--thing',
  resortId: 'test-peak',
  kind: 'apres',
  name: 'Thing',
  summary: 'A thing',
  wow: 2,
  interests: ['apres'],
  months: [12, 1, 2, 3],
  dates: null,
  links: {},
  sources: ['https://example.com'],
  ...over,
});

const WINDOW = { from: '2027-01-09', to: '2027-03-20', nights: 5 };
const love = (key: string, label = key): Signal => ({ key, label, strength: 'love', source: 'said' });

describe('ski data', () => {
  it('passes its own validation with no errors', () => {
    const { errors } = validateSki(SKI_RANGES, SKI_RESORTS, SKI_SCENE);
    expect(errors).toEqual([]);
  });

  it('gives every resort a range the planner knows', () => {
    const ranges = new Set(RANGES.map((range) => range.id));
    for (const entry of SKI_RESORTS) expect(ranges.has(entry.rangeId), entry.id).toBe(true);
  });

  it('links every ski spot on the globe to a resort in the planner', () => {
    const ids = new Set(SKI_RESORTS.map((entry) => entry.id));
    for (const resortId of Object.values(SPOT_RESORT)) expect(ids.has(resortId), resortId).toBe(true);
  });

  it('flags a price range that runs backwards and copy with an em dash', () => {
    const bad = resort({ summary: 'Big — bold', liftTicket: { currency: 'USD', low: 300, high: 100, season: '2026/27', sourceUrl: 'https://x.com', checkedOn: '2026-10-03' } });
    const { errors } = validateSki(RANGES, [bad], []);
    expect(errors.some((error) => error.includes('lift ticket range'))).toBe(true);
    expect(errors.some((error) => error.includes('summary'))).toBe(true);
  });

  it('requires an event without dates to say what is known', () => {
    const { errors } = validateSki(RANGES, [resort()], [item({ kind: 'event', dates: null })]);
    expect(errors.some((error) => error.includes('datesNote'))).toBe(true);
  });
});

describe('window', () => {
  it('counts days per month across the window', () => {
    const months = monthWeights('2027-01-30', '2027-02-02');
    expect(months.get(1)).toBe(2);
    expect(months.get(2)).toBe(2);
  });

  it('offers Saturday arrivals that fit inside the window', () => {
    const weeks = candidateWeeks({ from: '2027-01-04', to: '2027-01-31', nights: 5 });
    expect(weeks[0]).toEqual({ start: '2027-01-09', end: '2027-01-14' });
    expect(weeks.every((week) => week.end <= '2027-01-31')).toBe(true);
    expect(weeks.every((week) => new Date(`${week.start}T00:00:00Z`).getUTCDay() === 6)).toBe(true);
  });

  it('falls back to the window itself when no Saturday fits', () => {
    expect(candidateWeeks({ from: '2027-01-11', to: '2027-01-14', nights: 3 })).toEqual([{ start: '2027-01-11', end: '2027-01-14' }]);
  });

  it('labels months as a span, wrapping the new year', () => {
    expect(monthsLabel([12, 1, 2, 3, 4])).toBe('Dec to Apr');
    expect(monthsLabel([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe('Year-round');
    expect(monthsLabel([2])).toBe('Feb');
    expect(monthsLabel([1, 3])).toBe('Jan, Mar');
  });

  it('works out the US holiday weeks from the calendar', () => {
    const weeks = crowdWeeks(2027, 'US');
    // Presidents' Day 2027 is Monday Feb 15.
    expect(weeks.find((week) => week.label.startsWith('Presidents'))).toMatchObject({ start: '2027-02-13', end: '2027-02-21' });
    expect(crowdWeeks(2027, 'FR').some((week) => week.label.startsWith('Presidents'))).toBe(false);
  });
});

describe('matcher', () => {
  it('counts every interest the same with no profile, and loves above likes', () => {
    expect(interestWeights([]).apres).toBe(1);
    const weights = interestWeights([love('nights:apres'), { key: 'nights:live-music', label: 'Live music', strength: 'like', source: 'said' }]);
    expect(weights.apres).toBe(3);
    expect(weights['live-music']).toBe(2);
  });

  it('reads electronic genres as DJs and an avoided scene as zero', () => {
    const weights = interestWeights([love('music:genre:house', 'House'), { key: 'nights:dance', label: 'Dance floors', strength: 'avoid', source: 'said' }]);
    expect(weights.dj).toBe(0);
    expect(weights.nightlife).toBe(0);
  });

  it('puts the snow first: a closed mountain scores nothing for its parties', () => {
    const summer = { from: '2027-07-01', to: '2027-07-20', nights: 5 };
    const match = matchResort(resort(), [item({ months: [7] })], summer, interestWeights([]));
    expect(match.fit).toBe(0);
    expect(match.score).toBe(0);
    expect(match.tone).toBe('off');
  });

  it('ranks the resort with more of what they love above an equal mountain', () => {
    const a = resort({ id: 'a-peak' });
    const b = resort({ id: 'b-peak' });
    const scene = [
      item({ id: 'a-peak--party', resortId: 'a-peak', wow: 3, interests: ['dj'] }),
      item({ id: 'b-peak--dinner', resortId: 'b-peak', kind: 'restaurant', wow: 3, interests: ['fine-dining'] }),
    ];
    const ranked = rankResorts([a, b], scene, WINDOW, interestWeights([love('nights:dance')]));
    expect(ranked[0].resort.id).toBe('a-peak');
    expect(ranked[0].forThem.map((entry) => entry.id)).toEqual(['a-peak--party']);
  });

  it('rewards a mix of things over a pile of one kind', () => {
    const bars = resort({ id: 'bars' });
    const mix = resort({ id: 'mix' });
    const scene = [
      ...[1, 2, 3, 4].map((n) => item({ id: `bars--bar${n}`, resortId: 'bars', kind: 'apres', wow: 2 })),
      item({ id: 'mix--bar', resortId: 'mix', kind: 'apres', wow: 2 }),
      item({ id: 'mix--show', resortId: 'mix', kind: 'live-music', wow: 2, interests: ['live-music'] }),
      item({ id: 'mix--food', resortId: 'mix', kind: 'restaurant', wow: 2, interests: ['food'] }),
      item({ id: 'mix--spa', resortId: 'mix', kind: 'activity', wow: 2, interests: ['spa'] }),
    ];
    expect(rankResorts([bars, mix], scene, WINDOW, interestWeights([]))[0].resort.id).toBe('mix');
  });

  it('with no profile, calls out the great things rather than everything', () => {
    const weights = interestWeights([]);
    expect(isForThem(item({ wow: 1 }), weights)).toBe(false);
    expect(isForThem(item({ wow: 3 }), weights)).toBe(true);
  });

  it('picks the week a dated event is on, and marks the holiday crush', () => {
    const scene = [item({ id: 'test-peak--fest', kind: 'event', wow: 3, interests: ['festival'], dates: { start: '2027-03-08', end: '2027-03-10', sourceUrl: 'https://example.com' } })];
    const weeks = rankWeeks(resort(), scene, WINDOW, interestWeights([]));
    expect(weeks[0].start).toBe('2027-03-06');
    expect(weeks[0].reasons.join(' ')).toContain('Thing is on');
    const presidents = weeks.find((week) => week.start === '2027-02-13');
    expect(presidents?.crowd).toBe('Presidents’ Day week');
  });

  it('treats weeks before an announced opening as closed', () => {
    const early = { from: '2026-11-01', to: '2026-12-31', nights: 5 };
    const weeks = rankWeeks(resort({ season: { opensMonth: 11, closesMonth: 4, dates: { open: '2026-11-26', close: null, sourceUrl: 'https://example.com' } } }), [], early, interestWeights([]));
    expect(weeks.find((week) => week.start === '2026-11-07')?.reasons).toContain('Lifts closed');
  });

  it('sorts ranges by snow for the dates: the Andes sink in January', () => {
    const ranked = rankRanges(RANGES, [], [], WINDOW, interestWeights([]));
    expect(ranked[ranked.length - 1].tone).toBe('off');
    expect(['andes', 'oceania']).toContain(ranked[ranked.length - 1].range.id);
    expect(ranked[0].tone).toBe('good');
  });

  it('bands prices and formats the range in the local currency', () => {
    expect(priceBand(resort())).toBe('premium');
    expect(priceBand(resort({ liftTicket: { currency: 'EUR', low: 60, high: 70, season: '2026/27', sourceUrl: 'https://x.com', checkedOn: '2026-10-03' } }))).toBe('value');
    expect(priceBand(resort({ liftTicket: null }))).toBeNull();
    expect(formatTicket(resort())).toBe('$150 to $250');
    expect(formatTicket(resort({ liftTicket: { currency: 'JPY', low: 9000, high: 9000, season: '2026/27', sourceUrl: 'https://x.com', checkedOn: '2026-10-03' } }))).toBe('¥9,000');
  });
});

describe('votes', () => {
  it('ranks a loved option above a split one', () => {
    const votes = { Parks: { aspen: 1 as const, vail: 1 as const }, Lees: { aspen: 1 as const, vail: -1 as const } };
    expect(standing(votes, 'aspen')).toBeGreaterThan(standing(votes, 'vail'));
  });
});

describe('share links', () => {
  const known = (level: Level, id: string) => (level === 'range' ? ['colorado', 'utah'].includes(id) : ['test-peak'].includes(id));

  it('round-trips a plan and keeps only options it knows', () => {
    const code = encodePlan({ id: 'abcDEF123_-x', name: 'Ski week', window: WINDOW, party: 'family', level: 'range', options: ['colorado', 'utah', 'atlantis'], from: 'Matt' });
    const plan = decodePlan(code, known);
    expect(plan).toMatchObject({ id: 'abcDEF123_-x', name: 'Ski week', window: WINDOW, party: 'family', level: 'range', options: ['colorado', 'utah'], from: 'Matt' });
  });

  it('checks weeks are real dates at known resorts', () => {
    expect(optionValid('test-peak@2027-02-13', 'week', known)).toBe(true);
    expect(optionValid('test-peak@2027-02-30', 'week', known)).toBe(false);
    expect(optionValid('nowhere@2027-02-13', 'week', known)).toBe(false);
  });

  it('refuses broken, oversized or hostile links', () => {
    expect(decodePlan('not base64 !!', known)).toBeNull();
    expect(decodePlan('A'.repeat(5000), known)).toBeNull();
    const longWindow = encodePlan({ id: 'abcDEF123_-x', name: 'x', window: { from: '2027-01-01', to: '2029-01-01', nights: 5 }, party: 'crew', level: 'range', options: ['colorado'], from: '' });
    expect(decodePlan(longWindow, known)).toBeNull();
    const noOptions = encodePlan({ id: 'abcDEF123_-x', name: 'x', window: WINDOW, party: 'crew', level: 'range', options: ['atlantis'], from: '' });
    expect(decodePlan(noOptions, known)).toBeNull();
  });

  it('strips markup and caps names', () => {
    const code = encodePlan({ id: 'abcDEF123_-x', name: '<script>alert(1)</script>Trip', window: WINDOW, party: 'crew', level: 'range', options: ['colorado'], from: 'x'.repeat(100) });
    const plan = decodePlan(code, known)!;
    expect(plan.name).not.toMatch(/[<>]/);
    expect(plan.from.length).toBeLessThanOrEqual(40);
  });

  it('round-trips a reply and drops votes it cannot place', () => {
    const code = encodeReply({ tripId: 'abcDEF123_-x', by: 'The Parks', votes: { colorado: 1, utah: -1, atlantis: 1 } });
    const reply = decodeReply(code, (key) => key === 'colorado' || key === 'utah');
    expect(reply).toEqual({ tripId: 'abcDEF123_-x', by: 'The Parks', votes: { colorado: 1, utah: -1 } });
    expect(decodeReply(encodeReply({ tripId: 'abcDEF123_-x', by: '', votes: { colorado: 1 } }), () => true)).toBeNull();
  });

  it('makes trip ids that are random and link-safe', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newTripId()));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });
});
