import { score, type ScoreAnswer, type ScoreQuestion } from '../client';

/**
 * trip-fit@1: how well does each real listing fit this traveler and this trip?
 * One shared state (who they are, what the trip is, the candidates as
 * evidence) and one Score question per candidate, asked together. Candidates
 * come only from providers (Maps, Yelp, Tripadvisor, events); Jev ranks them
 * and never adds one.
 */
export const TRIP_FIT_CONTRACT = 'trip-fit@1';
export const FIT_BATCH = 24;

export const FIT_LEVELS = [
  'Wrong for this trip: clashes with what they said, their budget, or who is coming.',
  'Fine but generic: nothing ties it to what they said.',
  'Good fit: matches something they said they like, or the kind of trip.',
  'Standout: exactly what they described, or a place people are talking about that matches their taste.',
];

export type FitCandidate = {
  id: string;
  name: string;
  kind: string;
  category?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  snippet?: string;
  source: string;
};

export type FitContext = {
  /** Their own words about themselves, trimmed. */
  traveler: string;
  likes: string[];
  trip: { place: string; when?: string; crew?: string; mustDo?: string; notDoing?: string; tripType?: string | null };
};

export function tripFitState(context: FitContext, candidates: FitCandidate[]) {
  return {
    traveler: { in_their_words: context.traveler.slice(0, 600), likes: context.likes.slice(0, 24) },
    trip: context.trip,
    candidates: Object.fromEntries(candidates.map((candidate) => [candidate.id, {
      name: candidate.name.slice(0, 80),
      kind: candidate.kind,
      category: candidate.category?.slice(0, 60),
      rating: candidate.rating,
      reviews: candidate.reviews,
      price: candidate.price,
      snippet: candidate.snippet?.slice(0, 200),
      source: candidate.source,
    }])),
  };
}

const key = (id: string) => `fit_${id.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 48)}`;

export function tripFitQuestions(candidates: FitCandidate[]): Record<string, ScoreQuestion> {
  return Object.fromEntries(candidates.map((candidate) => [
    key(candidate.id),
    score(`How well does the place with id "${candidate.id}" in \`candidates\` fit \`traveler\` and \`trip\`? Use only what the state says about it.`, FIT_LEVELS),
  ]));
}

export type FitBand = 'standout' | 'good' | 'fine' | 'skip';
export type RankedCandidate = FitCandidate & { fit: number | null; band: FitBand | null; confidence: number | null; because: string | null };

/** The traveler's own words that a listing matches, quoted rather than invented. */
export function becauseLine(candidate: FitCandidate, likes: string[]): string | null {
  const text = `${candidate.name} ${candidate.category ?? ''} ${candidate.snippet ?? ''}`.toLowerCase();
  const hit = likes.find((like) => like.length >= 3 && text.includes(like.toLowerCase()));
  return hit ? `You said ${hit}` : null;
}

/**
 * Code ranks. With fit answers: by fit, then rating. Without (Jev down or
 * unconfigured): by rating, and the caller must say so. "Wrong for this trip"
 * is dropped unless that leaves too few to choose from.
 */
export function rankCandidates(candidates: FitCandidate[], answers: Record<string, ScoreAnswer> | null, likes: string[]): { ranked: RankedCandidate[]; rankedBy: 'fit' | 'rating' } {
  const byRating = (a: FitCandidate, b: FitCandidate) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviews ?? 0) - (a.reviews ?? 0) || a.id.localeCompare(b.id);
  if (!answers) {
    return { rankedBy: 'rating', ranked: [...candidates].sort(byRating).map((candidate) => ({ ...candidate, fit: null, band: null, confidence: null, because: becauseLine(candidate, likes) })) };
  }
  const ranked = candidates.map((candidate): RankedCandidate => {
    const answer = answers[key(candidate.id)];
    const fit = answer ? answer.score : null;
    const band: FitBand | null = fit === null ? null : fit >= 2.5 ? 'standout' : fit >= 1.6 ? 'good' : fit >= 0.8 ? 'fine' : 'skip';
    return { ...candidate, fit, band, confidence: answer?.confidence ?? null, because: becauseLine(candidate, likes) };
  }).sort((a, b) => (b.fit ?? -1) - (a.fit ?? -1) || byRating(a, b));
  const kept = ranked.filter((candidate) => candidate.band !== 'skip');
  return { rankedBy: 'fit', ranked: kept.length >= 6 ? kept : ranked };
}

export const fitKey = key;
