/**
 * Activities: why people travel, everywhere, and when to go. Spots (a surf
 * break, a ski area, a fjord) and dated events (a festival, a Grand Prix),
 * each with the months they're best. The globe draws them as its activity
 * layer; the card explains one. Built from the source data in
 * `src/data/activities/activities.json` (see `scripts/activities/`).
 */
export const CATEGORIES = [
  'ski', 'surf', 'beach', 'festival', 'concert', 'sports',
  'food', 'nightlife', 'nature', 'culture', 'wellness', 'city',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Tag = 'family' | 'solo' | 'nightlife' | 'luxury' | 'budget' | 'adrenaline';

/** Which live-conditions fetcher the card uses. `null` falls back to the general weather. */
export type ConditionsKind = 'snow' | 'marine' | 'beach' | 'aurora' | 'event' | null;

export interface EventDates {
  /** ISO dates, local to the event. */
  start: string;
  end: string;
  /** `under-review`: the organizer has the date in doubt; the card says so. */
  status: 'confirmed' | 'estimated' | 'under-review';
  sourceUrl: string;
}

/** Official links, checked by hand. Fallbacks (hashtag and search pages, flights, stays, maps) are built in code. */
export interface ActivityLinks {
  officialSite?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  /** Official tickets, lift pass, festival pass or permit page. */
  tickets?: string;
  wikipedia?: string;
}

export interface NearestAirport {
  iata: string;
  city: string;
  /** Only when a source states it ("35 min"). */
  driveTime?: string;
}

/** Why a profile-driven item is on the map. */
export interface ForYouReason {
  kind: 'artist' | 'team';
  name: string;
}

export interface Activity {
  id: string;
  name: string;
  place: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  category: Category;
  kind: 'place' | 'event';
  /** Months 1 to 12. */
  bestMonths: number[];
  peakMonths: number[];
  /** Null when the next edition's dates are not announced. */
  eventDates?: EventDates | null;
  /** Highest lift-served point, ski areas only. */
  elevationFt?: number | null;
  /** At most 90 characters. */
  summary: string;
  /** A short caveat shown on the card, e.g. a race held away from its usual venue. */
  note?: string;
  /** Why an event has no dates yet, with what is known. Required when `eventDates` is null. */
  datesNote?: string;
  tags: Tag[];
  /** 0 to 100, log-scaled Wikipedia pageviews over 30 days. */
  heat: number | null;
  conditions: ConditionsKind;
  sources: string[];
  links?: ActivityLinks;
  /** The first one drives the Instagram and TikTok fallbacks. No '#'. */
  hashtags?: string[];
  nearestAirports?: NearestAirport[];
  /** One plain line when booking early matters ("Permits sell out months ahead."). */
  bookAheadNote?: string;
  /** IANA time zone, looked up offline from the coordinates. */
  tz?: string;
  /** Profile-driven items (tour dates, games) from the For you layer; curated records have none. */
  source?: 'curated' | 'profile';
  reason?: ForYouReason;
  /** Profile items: the venue name and the provider's ticket page. */
  venue?: string;
  ticketUrl?: string;
}


export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  ski: { label: 'Ski', color: '#4FA3C7' },
  surf: { label: 'Surf', color: '#3D6FA8' },
  beach: { label: 'Beach', color: '#F7C548' },
  festival: { label: 'Festival', color: '#E4577E' },
  concert: { label: 'Concert', color: '#8E4DB8' },
  sports: { label: 'Sports', color: '#F26B2A' },
  food: { label: 'Food', color: '#D9A441' },
  nightlife: { label: 'Nightlife', color: '#E4577E' },
  nature: { label: 'Nature', color: '#6FAF7A' },
  culture: { label: 'Culture', color: '#C8A866' },
  wellness: { label: 'Wellness', color: '#E6CF9B' },
  city: { label: 'City', color: '#F4F1EA' },
};

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const byId = (list: readonly Activity[]) => new Map(list.map((a) => [a.id, a]));
