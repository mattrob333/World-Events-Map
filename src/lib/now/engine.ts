import type { CandidateJudgment, VenueCandidate } from '@/lib/opportunities';
import type {
  NowDimensionScores,
  NowPick,
  NowPickLabel,
  NowRequest,
  RankNowInput,
  ScoredVenue,
} from './types';

const INTENT_KEYWORDS: Record<NowRequest['intent'], string[]> = {
  food: ['restaurant', 'food', 'dining', 'cafe', 'bakery', 'bistro'],
  drinks: ['bar', 'cocktail', 'brewery', 'pub', 'wine', 'lounge', 'club'],
  music: ['music', 'concert', 'club', 'bar', 'performance', 'theatre', 'theater'],
  experience: ['museum', 'gallery', 'attraction', 'experience', 'market', 'park', 'entertainment'],
  surprise: [],
};

const ENERGY_TARGET: Record<NowRequest['vibe'], number | null> = {
  chill: 35,
  social: 62,
  lively: 84,
  surprise: null,
};

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round = (value: number) => Math.round(value * 10) / 10;

function normalizedCategory(candidate: VenueCandidate): string {
  return `${candidate.category} ${candidate.name}`.trim().toLocaleLowerCase();
}

function intentScore(candidate: VenueCandidate, request: NowRequest): number {
  if (request.intent === 'surprise') return 72;
  const haystack = normalizedCategory(candidate);
  const keywords = INTENT_KEYWORDS[request.intent];
  return keywords.some((keyword) => haystack.includes(keyword)) ? 100 : 25;
}

function currentBusyness(candidate: VenueCandidate): number | undefined {
  if (typeof candidate.liveBusyness === 'number') return clamp(candidate.liveBusyness);
  if (typeof candidate.expectedBusyness === 'number') return clamp(candidate.expectedBusyness);
  return undefined;
}

function energyScore(candidate: VenueCandidate, request: NowRequest): number {
  const busyness = currentBusyness(candidate);
  const target = ENERGY_TARGET[request.vibe];
  if (busyness === undefined) return 50;
  if (target === null) return clamp(45 + busyness * 0.45);
  return clamp(100 - Math.abs(busyness - target) * 1.55);
}

function qualityScore(candidate: VenueCandidate): number {
  if (typeof candidate.rating !== 'number') return 48;
  return clamp(((candidate.rating - 3) / 2) * 100);
}

function socialProofScore(candidate: VenueCandidate): number {
  const reviews = Math.max(0, candidate.reviewCount ?? 0);
  if (!reviews) return 20;
  return clamp((Math.log1p(reviews) / Math.log1p(5000)) * 100);
}

function distanceScore(candidate: VenueCandidate, request: NowRequest): number {
  if (typeof candidate.distanceMeters !== 'number') return 55;
  const radius = Math.max(250, request.radiusMeters);
  return clamp(100 * (1 - candidate.distanceMeters / radius));
}

function passesHardFilters(candidate: VenueCandidate, request: NowRequest): boolean {
  if (candidate.openNow === false) return false;
  if (
    typeof candidate.distanceMeters === 'number' &&
    candidate.distanceMeters > request.radiusMeters
  ) {
    return false;
  }
  if (
    typeof request.maxPriceLevel === 'number' &&
    typeof candidate.priceLevel === 'number' &&
    candidate.priceLevel > request.maxPriceLevel
  ) {
    return false;
  }
  if (
    typeof request.minRating === 'number' &&
    typeof candidate.rating === 'number' &&
    candidate.rating < request.minRating
  ) {
    return false;
  }
  if (
    typeof request.availableMinutes === 'number' &&
    typeof candidate.dwellMinutes === 'number' &&
    candidate.dwellMinutes > request.availableMinutes
  ) {
    return false;
  }
  return true;
}

function judgmentMap(judgments?: CandidateJudgment[]) {
  return new Map((judgments ?? []).map((judgment) => [judgment.candidateId, judgment]));
}

function buildReasons(
  candidate: VenueCandidate,
  request: NowRequest,
  dimensions: NowDimensionScores,
  judgment?: CandidateJudgment,
): string[] {
  const reasons: string[] = [];
  const busyness = currentBusyness(candidate);

  for (const reason of judgment?.reasons ?? []) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  if (dimensions.intent >= 90 && request.intent !== 'surprise') {
    reasons.push(`Strong ${request.intent} fit`);
  }
  if (typeof busyness === 'number') {
    if (candidate.liveBusyness !== undefined) reasons.push(`${Math.round(busyness)}% busy live`);
    else reasons.push(`${Math.round(busyness)}% expected busyness now`);
  }
  if (typeof candidate.rating === 'number' && candidate.rating >= 4.4) {
    reasons.push(`${candidate.rating.toFixed(1)} rating`);
  }
  if (typeof candidate.distanceMeters === 'number') {
    const km = candidate.distanceMeters / 1000;
    reasons.push(km < 1 ? `${Math.max(1, Math.round(candidate.distanceMeters))} m away` : `${km.toFixed(1)} km away`);
  }
  return [...new Set(reasons)].slice(0, 4);
}

function scoreOne(
  candidate: VenueCandidate,
  request: NowRequest,
  judgment?: CandidateJudgment,
): ScoredVenue {
  const dimensions: NowDimensionScores = {
    intent: round(intentScore(candidate, request)),
    energy: round(energyScore(candidate, request)),
    quality: round(qualityScore(candidate)),
    distance: round(distanceScore(candidate, request)),
    socialProof: round(socialProofScore(candidate)),
  };

  const deterministic =
    dimensions.intent * 0.25 +
    dimensions.energy * 0.25 +
    dimensions.quality * 0.2 +
    dimensions.distance * 0.2 +
    dimensions.socialProof * 0.1;

  const judgmentScore = judgment ? clamp(judgment.score) : undefined;
  if (judgmentScore !== undefined) dimensions.judgment = round(judgmentScore);

  // Structured judgment is supplemental. TypeSafe exposes confidence as 0..1,
  // so a flat/uncertain Choice distribution should have less influence than a
  // confident one. Providers that omit confidence get the original 35% cap.
  const judgmentWeight = judgmentScore === undefined
    ? 0
    : 0.35 * (judgment?.confidence === undefined ? 1 : clamp01(judgment.confidence));
  const score =
    judgmentScore === undefined
      ? deterministic
      : deterministic * (1 - judgmentWeight) + judgmentScore * judgmentWeight;

  return {
    candidate,
    score: round(clamp(score)),
    confidence: judgment?.confidence,
    reasons: buildReasons(candidate, request, dimensions, judgment),
    dimensions,
  };
}

export function rankNowCandidates({
  request,
  candidates,
  judgments,
}: RankNowInput): ScoredVenue[] {
  const judgmentsByCandidate = judgmentMap(judgments);
  return candidates
    .filter((candidate) => passesHardFilters(candidate, request))
    .map((candidate) => scoreOne(candidate, request, judgmentsByCandidate.get(candidate.id)))
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
}

function asPick(label: NowPickLabel, venue: ScoredVenue): NowPick {
  return {
    label,
    candidate: venue.candidate,
    score: venue.score,
    confidence: venue.confidence,
    reasons: venue.reasons,
    dimensions: venue.dimensions,
  };
}

function chooseMostAlive(remaining: ScoredVenue[]): ScoredVenue | undefined {
  return [...remaining].sort((a, b) => {
    const busyA = currentBusyness(a.candidate) ?? -1;
    const busyB = currentBusyness(b.candidate) ?? -1;
    return busyB - busyA || b.score - a.score;
  })[0];
}

function chooseWildcard(
  remaining: ScoredVenue[],
  selected: ScoredVenue[],
): ScoredVenue | undefined {
  const selectedCategories = new Set(
    selected.map((item) => item.candidate.category.toLocaleLowerCase()),
  );
  return [...remaining].sort((a, b) => {
    const diversityA = selectedCategories.has(a.candidate.category.toLocaleLowerCase()) ? 0 : 14;
    const diversityB = selectedCategories.has(b.candidate.category.toLocaleLowerCase()) ? 0 : 14;
    return b.score + diversityB - (a.score + diversityA);
  })[0];
}

export function selectNowPicks(scored: ScoredVenue[]): NowPick[] {
  if (scored.length === 0) return [];

  const selected: ScoredVenue[] = [];
  const picks: NowPick[] = [];
  const best = scored[0];
  selected.push(best);
  picks.push(asPick('best_match', best));

  let remaining = scored.filter((item) => item.candidate.id !== best.candidate.id);
  const alive = chooseMostAlive(remaining);
  if (alive) {
    selected.push(alive);
    picks.push(asPick('most_alive', alive));
    remaining = remaining.filter((item) => item.candidate.id !== alive.candidate.id);
  }

  const wildcard = chooseWildcard(remaining, selected);
  if (wildcard) picks.push(asPick('wildcard', wildcard));

  return picks;
}
