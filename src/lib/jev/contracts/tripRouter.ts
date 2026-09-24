import { choice, noul, type AnswersFor } from '../client';
import { TRIP_TYPES, type TripType } from './feedItem';

/**
 * trip-router@1: what is the traveler asking for, before anything expensive
 * runs? Jev picks among known intents (with an escape hatch); code decides
 * whether to recommend destinations, open the planner, or ask one follow-up.
 * Jev cannot extract the place: code finds it in the text first and passes
 * only whether it was found.
 */
export const TRIP_ROUTER_CONTRACT = 'trip-router@1';

export type TripRequestFacts = {
  text: string;
  placeFound: string | null;
  whenFound: boolean;
  whoFound: boolean;
  hasProfile: boolean;
};

export function tripRouterState(facts: TripRequestFacts) {
  return {
    request: facts.text.slice(0, 800),
    place_named_in_request: facts.placeFound,
    dates_mentioned: facts.whenFound,
    companions_mentioned: facts.whoFound,
    traveler_has_saved_profile: facts.hasProfile,
  };
}

export const tripRouterQuestions = {
  intent: choice('What is the traveler asking for in `request`?', {
    recommend_destination: 'Where to go: the best, most popular or right place for a kind of trip, without having settled on one place',
    plan_trip: 'A trip to a place they named (or clearly implied), to be planned',
    find_specific: 'One kind of thing in a place: a restaurant, a bar, an event, a hotel',
    question: 'A factual or practical travel question rather than a request to plan',
    unclear: 'Too little to tell what they want',
  }),
  trip_type: choice('Which kind of trip does `request` describe? Judge only from the words in `request`.', {
    ...Object.fromEntries(TRIP_TYPES.map((type) => [type, `A ${type.replace('-', ' ')} trip`])),
    none: 'No particular kind of trip is described',
  } as Record<TripType | 'none', string>),
  ready_to_plan: noul('Does `request` give enough to start planning: a destination (or a clear wish to be recommended one) and roughly when?', {
    true: 'A place or a destination request, plus a time frame or duration.',
    false: 'Missing the place or any sense of when.',
  }),
};

export type TripRouterAnswers = AnswersFor<typeof tripRouterQuestions>;

export type TripRoute =
  | { route: 'recommend'; tripType: TripType | null; confidence: number }
  | { route: 'plan'; tripType: TripType | null; confidence: number }
  | { route: 'follow_up'; question: string; confidence: number };

function followUp(facts: TripRequestFacts): string {
  if (!facts.placeFound) return 'Where are you thinking? A place, or just the feeling: "somewhere warm with good bars".';
  if (!facts.whenFound) return `When are you thinking of ${facts.placeFound}, and for how long?`;
  return 'Tell me a little more: who’s coming, and one thing you have to do there?';
}

/** Code decides. Uncertain intent never plans; it asks one question instead. */
export function routeTripRequest(facts: TripRequestFacts, answers: TripRouterAnswers | null): TripRoute {
  if (!answers) return fallbackRoute(facts);
  const intent = answers.intent.selected;
  const confidence = answers.intent.probabilities[intent] ?? 0;
  const typeP = answers.trip_type.probabilities[answers.trip_type.selected] ?? 0;
  const tripType = answers.trip_type.selected !== 'none' && typeP >= 0.4 ? (answers.trip_type.selected as TripType) : null;
  if (intent === 'unclear' || confidence < 0.5) return { route: 'follow_up', question: followUp(facts), confidence };
  if (intent === 'recommend_destination') return { route: 'recommend', tripType, confidence };
  if (!facts.placeFound) return intent === 'plan_trip' && tripType ? { route: 'recommend', tripType, confidence } : { route: 'follow_up', question: followUp(facts), confidence };
  return { route: 'plan', tripType, confidence };
}

const RECOMMEND = /\b(best|most popular|hottest|where should|which (?:place|city|town|resort|beach)|recommend|suggest|top (?:spot|place)s?|right now)\b/i;
const TYPE_WORDS: [TripType, RegExp][] = [
  ['ski', /\b(ski|skiing|snowboard|powder|slopes?)\b/i], ['surf', /\b(surf|surfing|waves?)\b/i], ['beach', /\b(beach|island|sun)\b/i],
  ['food', /\b(food|eat|restaurants?|foodie)\b/i], ['nightlife', /\b(nightlife|clubs?|bars?|party)\b/i], ['festivals', /\bfestivals?\b/i],
  ['music', /\b(concerts?|gigs?|live music)\b/i], ['sports', /\b(race|match|game|golf|tennis|f1|formula)\b/i], ['culture', /\b(museums?|art|history|culture)\b/i],
  ['adventure', /\b(safari|adventure|hike|trek)\b/i], ['wellness', /\b(spa|retreat|wellness)\b/i], ['family', /\b(kids|family)\b/i],
];

export function tripTypeFromText(text: string): TripType | null {
  return TYPE_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

/** Without Jev: plain word rules, clearly less capable, never guessing a place. */
export function fallbackRoute(facts: TripRequestFacts): TripRoute {
  const tripType = tripTypeFromText(facts.text);
  if (RECOMMEND.test(facts.text) && !facts.placeFound) return { route: 'recommend', tripType, confidence: 0 };
  if (facts.placeFound) return { route: 'plan', tripType, confidence: 0 };
  if (tripType) return { route: 'recommend', tripType, confidence: 0 };
  return { route: 'follow_up', question: followUp(facts), confidence: 0 };
}
