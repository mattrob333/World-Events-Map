import type {
  AffinityReason,
  AffinityResult,
  AffinityVector,
  PartyType,
  TravelModeInterestRecord,
  TravelModeRecord,
  WeightedInterest,
} from './types';

const INTEREST_POINTS = 55;
const PARTY_POINTS = 15;
const ORIGIN_POINTS = 10;
const DESTINATION_POINTS = 12;
const DATE_POINTS = 8;

function normal(value?: string | null): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

function interestMap(interests: WeightedInterest[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of interests) {
    const key = normal(item.name);
    if (!key) continue;
    const weight = Math.max(1, Math.min(5, Math.round(item.weight || 1)));
    map.set(key, Math.max(map.get(key) ?? 0, weight));
  }
  return map;
}

function scoreInterests(a: WeightedInterest[], b: WeightedInterest[]) {
  const left = interestMap(a);
  const right = interestMap(b);
  const keys = new Set([...left.keys(), ...right.keys()]);
  if (keys.size === 0) return { points: 0, shared: [] as string[] };

  let intersection = 0;
  let union = 0;
  const shared: string[] = [];
  for (const key of keys) {
    const av = left.get(key) ?? 0;
    const bv = right.get(key) ?? 0;
    intersection += Math.min(av, bv);
    union += Math.max(av, bv);
    if (av > 0 && bv > 0) shared.push(key);
  }

  return {
    points: union === 0 ? 0 : (intersection / union) * INTEREST_POINTS,
    shared,
  };
}

function partyCompatibility(a?: PartyType | null, b?: PartyType | null): number {
  if (!a || !b) return 0;
  if (a === b) return PARTY_POINTS;
  if (a === 'mixed' || b === 'mixed') return 6;
  return 0;
}

function originCompatibility(a: AffinityVector, b: AffinityVector): number {
  const airportA = normal(a.originAirport);
  const airportB = normal(b.originAirport);
  if (airportA && airportA === airportB) return ORIGIN_POINTS;
  const cityA = normal(a.originCity);
  const cityB = normal(b.originCity);
  if (cityA && cityA === cityB) return 8;
  return 0;
}

function destinationCompatibility(a?: string | null, b?: string | null): number {
  const left = normal(a);
  const right = normal(b);
  if (!left || !right) return 0;
  if (left === right) return DESTINATION_POINTS;
  if (left.includes(right) || right.includes(left)) return 6;
  return 0;
}

function parseDate(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : null;
}

function dateCompatibility(a: AffinityVector, b: AffinityVector): number {
  const aStart = parseDate(a.startDate);
  const aEnd = parseDate(a.endDate ?? a.startDate);
  const bStart = parseDate(b.startDate);
  const bEnd = parseDate(b.endDate ?? b.startDate);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return 0;
  return Math.max(aStart, bStart) <= Math.min(aEnd, bEnd) ? DATE_POINTS : 0;
}

export function affinityScore(a: AffinityVector, b: AffinityVector): AffinityResult {
  const reasons: AffinityReason[] = [];
  let score = 0;

  const interest = scoreInterests(a.interests, b.interests);
  if (interest.points > 0) {
    score += interest.points;
    reasons.push({
      kind: 'interest',
      label: `Shared: ${interest.shared.slice(0, 4).join(', ')}`,
      points: interest.points,
    });
  }

  const party = partyCompatibility(a.partyType, b.partyType);
  if (party > 0) {
    score += party;
    reasons.push({
      kind: 'party',
      label: a.partyType === b.partyType ? `Both traveling ${a.partyType}` : 'Compatible party type',
      points: party,
    });
  }

  const origin = originCompatibility(a, b);
  if (origin > 0) {
    score += origin;
    reasons.push({ kind: 'origin', label: 'Overlapping origin', points: origin });
  }

  const destination = destinationCompatibility(a.destination, b.destination);
  if (destination > 0) {
    score += destination;
    reasons.push({
      kind: 'destination',
      label: 'Overlapping destination intent',
      points: destination,
    });
  }

  const dates = dateCompatibility(a, b);
  if (dates > 0) {
    score += dates;
    reasons.push({ kind: 'dates', label: 'Travel dates overlap', points: dates });
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.sort((x, y) => y.points - x.points),
  };
}

export function vectorFromMode(
  mode: TravelModeRecord,
  interests: TravelModeInterestRecord[],
): AffinityVector {
  return {
    interests: interests
      .filter((item) => item.mode_id === mode.id)
      .map((item) => ({ name: item.interest, weight: item.weight })),
    partyType: mode.party_type,
    originCity: mode.origin_city,
    originAirport: mode.origin_airport,
    destination: mode.destination,
    startDate: mode.start_date,
    endDate: mode.end_date,
  };
}
