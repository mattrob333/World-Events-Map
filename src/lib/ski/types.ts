/**
 * The ski planner's data: mountain ranges, the resorts in them, and what else
 * is going on around each one (après, DJs, live music, events, restaurants).
 * Every fact is checked by hand and carries its source; a field nobody could
 * check is null, never a guess. Built from `src/data/ski/*.json`.
 */

export const PASSES = ['epic', 'ikon', 'mountain-collective', 'indy'] as const;
export type Pass = (typeof PASSES)[number];

export const PASS_LABEL: Record<Pass, string> = {
  epic: 'Epic',
  ikon: 'Ikon',
  'mountain-collective': 'Mountain Collective',
  indy: 'Indy',
};

export const VIBES = [
  'apres', 'nightlife', 'luxury', 'family', 'expert', 'powder', 'scenery',
  'budget', 'beginner', 'village', 'terrain-park', 'backcountry',
] as const;
export type Vibe = (typeof VIBES)[number];

export const VIBE_LABEL: Record<Vibe, string> = {
  apres: 'Après',
  nightlife: 'Nightlife',
  luxury: 'Luxury',
  family: 'Family',
  expert: 'Expert terrain',
  powder: 'Powder',
  scenery: 'Views',
  budget: 'Good value',
  beginner: 'Beginners',
  village: 'Village',
  'terrain-park': 'Terrain park',
  backcountry: 'Backcountry',
};

export const CURRENCIES = ['USD', 'CAD', 'EUR', 'CHF', 'JPY', 'NZD', 'AUD', 'CLP', 'ARS', 'NOK', 'SEK'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface SkiRange {
  id: string;
  name: string;
  /** Where on the map: country or countries, for the card's kicker. */
  where: string;
  hemisphere: 'north' | 'south';
  lat: number;
  lng: number;
  /** Months 1 to 12 when its resorts are typically open. */
  seasonMonths: number[];
  bestMonths: number[];
  /** At most 90 characters. */
  summary: string;
  /** Two colors for the card, so ranges are easy to tell apart while swiping. */
  colors: [string, string];
  sources: string[];
}

export interface LiftTicket {
  currency: Currency;
  /** Adult one-day: the cheapest published price (advance online or low season). */
  low: number;
  /** Adult one-day: the top published price (window or peak holiday). */
  high: number;
  /** The season the prices are for, e.g. "2026/27", or "2026" in the south. */
  season: string;
  sourceUrl: string;
  /** ISO date the prices were read. */
  checkedOn: string;
  /** Only a starting price is published: shown as "from". */
  fromOnly?: boolean;
  note?: string;
}

export interface Airport {
  iata: string;
  city: string;
  /** Only when a source states it ("35 min"). */
  driveTime?: string;
}

export interface SkiResort {
  id: string;
  name: string;
  rangeId: string;
  place: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  season: {
    opensMonth: number;
    closesMonth: number;
    /** Only when the coming season's dates are announced; closing is often announced later. */
    dates: { open: string; close: string | null; sourceUrl: string } | null;
  };
  bestMonths: number[];
  peakMonths: number[];
  topFt: number | null;
  verticalFt: number | null;
  skiableAcres: number | null;
  trails: number | null;
  passes: Pass[];
  liftTicket: LiftTicket | null;
  vibe: Vibe[];
  /** At most 90 characters. */
  summary: string;
  why: string;
  family?: { skiSchool?: string; childcare?: boolean | null };
  links: { officialSite: string; tickets?: string; instagram?: string };
  nearestAirports: Airport[];
  sources: string[];
}

export const SCENE_KINDS = ['apres', 'club', 'live-music', 'event', 'restaurant', 'activity'] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

export const SCENE_KIND_LABEL: Record<SceneKind, string> = {
  apres: 'Après',
  club: 'Nightlife',
  'live-music': 'Live music',
  event: 'Event',
  restaurant: 'Food',
  activity: 'Off the slopes',
};

export const INTERESTS = [
  'apres', 'dj', 'live-music', 'concert', 'festival', 'food', 'fine-dining',
  'nightlife', 'spa', 'adventure', 'family', 'culture', 'sports', 'scenery', 'luxury',
] as const;
export type Interest = (typeof INTERESTS)[number];

export const INTEREST_LABEL: Record<Interest, string> = {
  apres: 'Après',
  dj: 'DJs',
  'live-music': 'Live music',
  concert: 'Concerts',
  festival: 'Festivals',
  food: 'Food',
  'fine-dining': 'Fine dining',
  nightlife: 'Nightlife',
  spa: 'Spa and hot springs',
  adventure: 'Adventure',
  family: 'Family',
  culture: 'Culture',
  sports: 'Big sport',
  scenery: 'Views',
  luxury: 'Luxury',
};

/** Something to do around a resort: a place that's always there, or a dated event. */
export interface SceneItem {
  id: string;
  resortId: string;
  kind: SceneKind;
  name: string;
  /** At most 90 characters. */
  summary: string;
  /** 3: people travel for it and post it. 2: great. 1: a solid local pick. */
  wow: 1 | 2 | 3;
  interests: Interest[];
  /** Months 1 to 12 when it runs or is open. */
  months: number[];
  /** Only when the coming edition's dates are announced. */
  dates: { start: string; end: string; sourceUrl: string } | null;
  /** For events without dates: what is known ("Usually late January"). */
  datesNote?: string;
  links: { officialSite?: string; instagram?: string };
  sources: string[];
}
