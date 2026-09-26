import { choice, noul, score, type AnswersFor } from '../client';

/**
 * feed-item@1: is a story from the source library worth showing, and to whom?
 *
 * State is evidence only (the item's own title and excerpt plus what the
 * library says about its publisher); no conclusions from earlier steps.
 * Runs in shadow first: the route is recorded, nothing is published on it,
 * until labeled samples show Jev's confidence tracks accuracy.
 *
 * @2 adds who can use it: dope.travel readers live in the US, so a card,
 * offer or fare only a resident of another country can use is not for them.
 */
export const FEED_ITEM_CONTRACT = 'feed-item@2';

export const TRIP_TYPES = [
  'ski', 'surf', 'beach', 'city', 'food', 'nightlife', 'music', 'festivals', 'sports', 'luxury',
  'family', 'adventure', 'outdoors', 'culture', 'wellness', 'road-trip', 'cruise', 'deals', 'points', 'business',
] as const;
export type TripType = (typeof TRIP_TYPES)[number];

export const REGIONS = [
  'global', 'usa', 'canada', 'mexico', 'caribbean', 'latin-america', 'europe', 'uk-ireland', 'africa',
  'middle-east', 'south-asia', 'japan', 'east-asia', 'southeast-asia', 'oceania',
] as const;
export type Region = (typeof REGIONS)[number];

export type FeedItemEvidence = {
  title: string;
  excerpt: string;
  publisher: string;
  publisherKind: string;
  publisherTripTypes: string[];
  publisherRegions: string[];
  publishedAt: string;
};

export function feedItemState(item: FeedItemEvidence) {
  return {
    title: item.title.slice(0, 300),
    excerpt: item.excerpt.slice(0, 1200),
    publisher: item.publisher.slice(0, 120),
    publisher_kind: item.publisherKind,
    publisher_usual_trip_types: item.publisherTripTypes.slice(0, 8),
    publisher_usual_regions: item.publisherRegions.slice(0, 8),
    published_at: item.publishedAt,
  };
}

const TRIP_TYPE_HINT: Record<TripType, string> = {
  ski: 'Skiing, snowboarding, snow, mountain resorts in winter',
  surf: 'Surfing, surf towns, swells, surf trips',
  beach: 'Beaches, islands, resorts by the sea (not mainly surfing)',
  city: 'A city break: neighborhoods, sights, what is new in a city',
  food: 'Restaurants, chefs, openings, food scenes, markets',
  nightlife: 'Bars, clubs, cocktail spots, going out at night',
  music: 'Concerts, tours, artists playing live, music venues',
  festivals: 'Festivals and big recurring events (music, culture, carnival)',
  sports: 'Travelling to watch or play sport: races, matches, tournaments, golf',
  luxury: 'High-end hotels, villas, yachts, private experiences',
  family: 'Travel with kids and families',
  adventure: 'Expeditions, safaris, extreme or active adventure',
  outdoors: 'Hiking, parks, camping, nature',
  culture: 'Museums, art, history, architecture, local traditions',
  wellness: 'Spas, retreats, wellness and medical travel',
  'road-trip': 'Driving routes and road trips',
  cruise: 'Cruises and river boats',
  deals: 'Fare sales, discounts, cheap trips',
  points: 'Airline miles, hotel points, credit card travel rewards',
  business: 'Business travel, airports, airlines as industry news',
};

export const feedItemQuestions = {
  travel_relevance: noul(
    'Does `title` and `excerpt` describe something a traveler could act on or plan around: a place, an opening, an event, a trip idea, or a material change to travel? Use only the supplied text; the publisher fields describe what the source usually covers, not this item.',
    { true: 'A traveler could use this to choose where or when to go, or what to do there.', false: 'Generic lifestyle, product or corporate news, opinion with no place or event, or unrelated news.' },
  ),
  trip_type: choice(
    'Which kind of trip is this item most useful for? Judge from `title` and `excerpt`.',
    { ...TRIP_TYPE_HINT, none: 'Not useful for any of these kinds of trip, or not about travel at all' },
  ),
  region: choice(
    'Where is the place, event or change described in `title` and `excerpt`? Choose the most specific region that fits.',
    {
      global: 'Several regions, or not tied to one place',
      usa: 'United States', canada: 'Canada', mexico: 'Mexico', caribbean: 'Caribbean islands',
      'latin-america': 'Central or South America', europe: 'Continental Europe', 'uk-ireland': 'United Kingdom or Ireland',
      africa: 'Africa', 'middle-east': 'Middle East', 'south-asia': 'India, Sri Lanka, Nepal, Maldives and neighbours',
      japan: 'Japan', 'east-asia': 'China, Korea, Taiwan, Hong Kong, Mongolia', 'southeast-asia': 'Thailand, Vietnam, Indonesia, Philippines and neighbours',
      oceania: 'Australia, New Zealand, Pacific islands',
      unclear: 'The text does not say where',
    },
  ),
  newsworthy: score(
    'How much would a well-travelled friend want to hear about this right now? Judge the supplied text only.',
    [
      'Routine or evergreen: nothing new or time-bound.',
      'A minor update or a list of well-known places.',
      'A specific new opening, event, route or change with concrete details.',
      'Something people will talk about: a first, a big opening, a rare event, or catching a place early.',
    ],
  ),
  sales_pitch: noul(
    'Is the text mainly trying to sell something: sponsored or affiliate copy, a deal or promo code, a product roundup, or a booking pitch?',
    { true: 'The main purpose is to sell or earn a commission.', false: 'The main purpose is to report or inform, even if it mentions a price.' },
  ),
  us_usable: noul(
    'Can a traveler who lives in the United States act on `title` and `excerpt` as written? A credit card, bank offer, sign-up bonus or loyalty promotion counts only if a US resident can apply or register. A fare counts only if a US traveler can book it from home at that price. A place, hotel, lounge, event or product abroad that any visitor can use counts. Judge the supplied text; the publisher fields describe what the source usually covers.',
    { true: 'A US resident can apply, register, book or visit as described.', false: 'Only residents of another country can use it: a card or bank offer from a non-US bank, a promotion for non-US members, or a fare priced from a foreign home city.' },
  ),
  audience: choice(
    'Which readers is `title` and `excerpt` written for? Judge from currency, banks, cards, departure cities and spelling in the supplied text.',
    {
      us: 'People who live in the United States',
      canada: 'People who live in Canada',
      'uk-ireland': 'People who live in the UK or Ireland',
      europe: 'People who live in continental Europe',
      'australia-nz': 'People who live in Australia or New Zealand',
      singapore: 'People who live in Singapore',
      'asia-other': 'People who live elsewhere in Asia',
      anyone: 'Any traveler, wherever they live',
    },
  ),
  risky_instructions: noul(
    'Does the text give dosing, medical treatment, drug use or payment and booking instructions a reader might follow?',
    { true: 'It instructs the reader on dosing, treatment, drug use, or how to pay or book.', false: 'No such instructions.' },
  ),
};

export type FeedItemAnswers = AnswersFor<typeof feedItemQuestions>;

/** Trip types where the story is a card, offer or fare the reader must be eligible for. */
const MONEY_TYPES: ReadonlySet<string> = new Set(['points', 'deals']);

/** What code may do with a story. Each action class has its own bar. */
export type FeedItemRoute = 'reject' | 'review' | 'personal' | 'public';

/**
 * Code keeps authority. Thresholds belong to the action, not the model:
 * a private, re-rankable personal feed can take a lower bar than a public
 * publish, and risky instructions always go to review.
 */
export function routeFeedItem(a: FeedItemAnswers): { route: FeedItemRoute; why: string } {
  const relevance = a.travel_relevance.p;
  const newsworthy = a.newsworthy.score;
  const typeConfidence = a.trip_type.probabilities[a.trip_type.selected] ?? 0;
  if (relevance < 0.35) return { route: 'reject', why: 'not travel-relevant' };
  if (a.trip_type.selected === 'none' && typeConfidence >= 0.6) return { route: 'reject', why: 'no trip type fits' };
  // US readers: money stories need a higher bar than a place anyone can visit.
  const usUsable = a.us_usable.p;
  const money = MONEY_TYPES.has(a.trip_type.selected);
  if (money && usUsable < 0.25) return { route: 'reject', why: 'card, offer or fare not open to US residents' };
  if (usUsable < 0.1) return { route: 'reject', why: 'not usable by US travelers' };
  if (money && usUsable < 0.6) return { route: 'review', why: 'unclear if US residents can use this offer' };
  if (a.risky_instructions.p >= 0.3) return { route: 'review', why: 'possible dosing, medical or payment instructions' };
  if (a.sales_pitch.p >= 0.5) return { route: 'review', why: 'reads as a sales pitch' };
  if (relevance >= 0.85 && newsworthy >= 2 && a.sales_pitch.p < 0.3 && a.risky_instructions.p < 0.15 && typeConfidence >= 0.6 && usUsable >= 0.7) {
    return { route: 'public', why: 'relevant, newsworthy and clean' };
  }
  if (relevance >= 0.7 && newsworthy >= 1.5) return { route: 'personal', why: 'relevant enough to rank for a traveler' };
  return { route: 'review', why: 'uncertain' };
}
