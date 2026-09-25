import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { fallbackRoute, routeTripRequest, tripTypeFromText, type TripRouterAnswers } from './tripRouter';
import { becauseLine, fitKey, rankCandidates, tripFitQuestions, type FitCandidate } from './tripFit';
import { routeFeedItem, type FeedItemAnswers } from './feedItem';

const facts = (text: string, placeFound: string | null = null) => ({ text, placeFound, regionFound: null, whenFound: /october|february|week/i.test(text), whoFound: false, hasProfile: true });
const router = (intent: string, p: number, tripType = 'ski'): TripRouterAnswers => ({
  intent: { type: 'choice', selected: intent, probabilities: { recommend_destination: 0, plan_trip: 0, find_specific: 0, question: 0, unclear: 0, [intent]: p }, confidence: p },
  trip_type: { type: 'choice', selected: tripType, probabilities: { [tripType]: 0.8, none: 0.2 }, confidence: 0.8 },
  ready_to_plan: { type: 'noul', p: 0.8 },
}) as unknown as TripRouterAnswers;

describe('trip-router@1 routing', () => {
  it('recommends destinations for "best X right now"', () => {
    expect(routeTripRequest(facts('best ski spot right now?'), router('recommend_destination', 0.9))).toMatchObject({ route: 'recommend', tripType: 'ski' });
  });
  it('plans when a place is named, asks when intent is uncertain', () => {
    expect(routeTripRequest(facts('Japan for a week in February', 'Japan'), router('plan_trip', 0.9, 'culture'))).toMatchObject({ route: 'plan', tripType: 'culture' });
    expect(routeTripRequest(facts('hmm'), router('plan_trip', 0.4))).toMatchObject({ route: 'follow_up' });
  });
  it('never plans without a place: asks where, or recommends by kind', () => {
    expect(routeTripRequest(facts('plan me something'), router('plan_trip', 0.9, 'none'))).toMatchObject({ route: 'follow_up' });
    expect(routeTripRequest(facts('plan me a surf trip'), router('plan_trip', 0.9, 'surf'))).toMatchObject({ route: 'recommend', tripType: 'surf' });
  });
  it('falls back to plain word rules without Jev', () => {
    expect(fallbackRoute(facts('where is the best surf town?'))).toMatchObject({ route: 'recommend', tripType: 'surf' });
    expect(fallbackRoute(facts('Lisbon in October', 'Lisbon'))).toMatchObject({ route: 'plan' });
    expect(fallbackRoute(facts('hello'))).toMatchObject({ route: 'follow_up' });
    expect(tripTypeFromText('powder days')).toBe('ski');
  });
});

describe('trip-fit@1 ranking', () => {
  const candidates: FitCandidate[] = [
    { id: 'a', name: 'Sushi Saito', kind: 'food', category: 'Omakase', rating: 4.9, source: 'Google Maps' },
    { id: 'b', name: 'Tourist Grill', kind: 'food', rating: 4.8, source: 'Google Maps' },
    { id: 'c', name: 'Bar High Five', kind: 'drinks', rating: 4.7, source: 'Yelp' },
  ];
  const fit = (value: number) => ({ type: 'score' as const, score: value, levels: 4, probabilities: [0, 0, 0, 1], confidence: 0.8 });
  it('asks one Score per candidate on a shared state', () => {
    expect(Object.keys(tripFitQuestions(candidates))).toEqual(['fit_a', 'fit_b', 'fit_c']);
    expect(fitKey('x-y/z')).toBe('fit_x_y_z');
  });
  it('ranks by fit, quotes the traveler, and falls back to rating honestly', () => {
    const { ranked, rankedBy } = rankCandidates(candidates, { fit_a: fit(2.8), fit_b: fit(0.3), fit_c: fit(2.0) }, ['omakase']);
    expect(rankedBy).toBe('fit');
    expect(ranked.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    expect(ranked[0]!.band).toBe('standout');
    expect(ranked[0]!.because).toBe('Matches your likes: omakase');
    const fallback = rankCandidates(candidates, null, []);
    expect(fallback.rankedBy).toBe('rating');
    expect(fallback.ranked.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(becauseLine(candidates[1]!, ['omakase'])).toBeNull();
  });
  it('matches likes as whole words only', () => {
    const base = { id: 'x', kind: 'sight', source: 'Google Maps' };
    expect(becauseLine({ ...base, name: 'Martinho da Arcada', category: 'Barbershop' }, ['Art'])).toBeNull();
    expect(becauseLine({ ...base, name: 'Galeria Zé dos Bois', category: 'Art gallery' }, ['Art'])).toBe('Matches your likes: art');
    expect(becauseLine({ ...base, name: 'Taqueria', category: 'Tacos' }, ['Taco'])).toBe('Matches your likes: taco');
  });
});

describe('feed-item@1 routing', () => {
  const a = (over: Partial<Record<string, number>> = {}): FeedItemAnswers => ({
    travel_relevance: { type: 'noul', p: over.rel ?? 0.9 },
    trip_type: { type: 'choice', selected: 'food', probabilities: { food: over.type ?? 0.8 }, confidence: 0.8 },
    region: { type: 'choice', selected: 'japan', probabilities: { japan: 0.9 }, confidence: 0.9 },
    newsworthy: { type: 'score', score: over.news ?? 2.4, levels: 4, probabilities: [0, 0, 0.6, 0.4], confidence: 0.8 },
    sales_pitch: { type: 'noul', p: over.pitch ?? 0.05 },
    risky_instructions: { type: 'noul', p: over.risk ?? 0.01 },
  }) as unknown as FeedItemAnswers;
  it('has a higher bar for public than for a personal feed, and sends risk to review', () => {
    expect(routeFeedItem(a()).route).toBe('public');
    expect(routeFeedItem(a({ rel: 0.75, news: 1.6 })).route).toBe('personal');
    expect(routeFeedItem(a({ risk: 0.4 })).route).toBe('review');
    expect(routeFeedItem(a({ pitch: 0.6 })).route).toBe('review');
    expect(routeFeedItem(a({ rel: 0.2 })).route).toBe('reject');
  });
});
