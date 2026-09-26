import 'server-only';

import type { VenueFactsProvider } from './providers';
import type { VenueCandidate, VenueSearchInput } from './types';

type UnknownRecord = Record<string, unknown>;

const TYPE_MAP: Record<string, string[]> = {
  food: ['RESTAURANT', 'CAFE', 'FOOD_AND_DRINK', 'BAKERY'],
  drinks: ['BAR', 'CLUBS', 'BREWERY', 'CAFE', 'WINERY'],
  music: ['CONCERT_HALL', 'PERFORMING_ARTS', 'EVENT_VENUE', 'CLUBS', 'BAR'],
  experience: ['MUSEUM', 'ARTS', 'MARKET', 'PARK', 'TOURIST_DESTINATION', 'EVENT_VENUE'],
  surprise: ['RESTAURANT', 'BAR', 'CAFE', 'MUSEUM', 'ARTS', 'MARKET', 'EVENT_VENUE'],
};

function record(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function number(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function numericSeries(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function currentTrafficSample(value: unknown, localIndex?: number): number | undefined {
  const values = numericSeries(value);
  if (values.length === 0) return undefined;
  // With `now=true`, BestTime documents a one-element `day_raw` containing the
  // current local hour. If a wider array is ever returned, honor the provider's
  // explicit `time_local_index` instead of silently taking midnight/first hour.
  if (values.length === 1) return values[0];
  if (
    localIndex !== undefined &&
    Number.isInteger(localIndex) &&
    localIndex >= 0 &&
    localIndex < values.length
  ) {
    return values[localIndex];
  }
  return undefined;
}

function haversineMeters(a: VenueSearchInput['location'], b: VenueSearchInput['location']): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const root =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.atan2(Math.sqrt(root), Math.sqrt(1 - root)));
}

function requestedTypes(categories?: string[]): string[] {
  const types = new Set<string>();
  for (const category of categories ?? []) {
    const key = category.toLocaleLowerCase();
    for (const type of TYPE_MAP[key] ?? [category.toUpperCase()]) types.add(type);
  }
  return [...types];
}

function overlapsMinuteRange(
  windowStart: number,
  windowEnd: number,
  periodStart: number,
  periodEnd: number,
): boolean {
  return periodStart <= windowEnd && periodEnd > windowStart;
}

/**
 * BestTime's Venue Filter returns the current local hour, not the current local
 * minute. Avoid pretending we know more than the source does: a venue is marked
 * closed only when its entire current-hour window falls outside every published
 * opening period. If the hour overlaps a period at all, it stays viable.
 */
function openDuringLocalHour(venue: UnknownRecord, localHour?: number): boolean | undefined {
  if (localHour === undefined || localHour < 0 || localHour > 23) return undefined;
  const dayInfo = record(venue.day_info);
  const schedule = record(dayInfo?.venue_open_close_v2);
  if (!schedule) return undefined;
  if (schedule.open_24h === true) return true;
  const rawPeriods = schedule['24h'];
  if (!Array.isArray(rawPeriods)) return undefined;
  if (rawPeriods.length === 0) return false;

  const hourStart = Math.floor(localHour) * 60;
  const hourEnd = hourStart + 60;
  let sawUsablePeriod = false;

  for (const rawPeriod of rawPeriods) {
    const period = record(rawPeriod);
    if (!period) continue;
    if (period.open_24h === true) return true;

    const opens = number(period.opens);
    const closes = number(period.closes);
    if (opens === undefined || closes === undefined) continue;
    sawUsablePeriod = true;

    const start = Math.max(0, Math.min(1439, opens * 60 + (number(period.opens_minutes) ?? 0)));
    const end = Math.max(0, Math.min(1440, closes * 60 + (number(period.closes_minutes) ?? 0)));
    const crossesMidnight = period.crosses_midnight === true || end <= start;

    if (!crossesMidnight && overlapsMinuteRange(hourStart, hourEnd, start, end)) return true;
    if (
      crossesMidnight &&
      (overlapsMinuteRange(hourStart, hourEnd, start, 1440) ||
        overlapsMinuteRange(hourStart, hourEnd, 0, end))
    ) {
      return true;
    }
  }

  return sawUsablePeriod ? false : undefined;
}

/**
 * When the opening period that covers this hour ends, in minutes after
 * midnight (past midnight runs over 1440, so 2am is 1560). Undefined when
 * the hours are unknown or it's open all day.
 */
export function closingMinutes(venue: UnknownRecord, localHour?: number): number | undefined {
  if (localHour === undefined || localHour < 0 || localHour > 23) return undefined;
  const schedule = record(record(venue.day_info)?.venue_open_close_v2);
  if (!schedule || schedule.open_24h === true || !Array.isArray(schedule['24h'])) return undefined;
  const hourStart = Math.floor(localHour) * 60;
  for (const rawPeriod of schedule['24h']) {
    const period = record(rawPeriod);
    if (!period || period.open_24h === true) continue;
    const opens = number(period.opens);
    const closes = number(period.closes);
    if (opens === undefined || closes === undefined) continue;
    const start = opens * 60 + (number(period.opens_minutes) ?? 0);
    const end = closes * 60 + (number(period.closes_minutes) ?? 0);
    const crosses = period.crosses_midnight === true || end <= start;
    if (!crosses && hourStart + 60 > start && hourStart < end) return end;
    // Past midnight: it closes "tomorrow" if we're in the evening part, "today" if in the early-morning tail.
    if (crosses && hourStart + 60 > start) return end + 1440;
    if (crosses && hourStart < end) return end + 1440;
  }
  return undefined;
}

export function parseBestTimeVenue(
  raw: unknown,
  origin: VenueSearchInput['location'],
  localHour?: number,
  localIndex?: number,
): VenueCandidate | null {
  const venue = record(raw);
  if (!venue) return null;
  const info = record(venue.venue_info);
  const id = text(venue.venue_id) ?? text(info?.venue_id);
  const name = text(venue.venue_name) ?? text(info?.venue_name);
  const lat = number(venue.venue_lat) ?? number(info?.venue_lat);
  const lng = number(venue.venue_lng) ?? number(info?.venue_lng);
  if (!id || !name || lat === undefined || lng === undefined) return null;

  const dwellMin = number(venue.venue_dwell_time_min) ?? number(info?.venue_dwell_time_min);
  const dwellMax = number(venue.venue_dwell_time_max) ?? number(info?.venue_dwell_time_max);
  const dwellMinutes = dwellMax && dwellMax > 0
    ? dwellMax
    : dwellMin && dwellMin > 0
      ? dwellMin
      : undefined;

  const rating = number(venue.rating) ?? number(info?.rating);
  const reviewCount = number(venue.reviews) ?? number(info?.reviews);
  const priceLevel = number(venue.price_level) ?? number(info?.price_level);
  const expectedBusyness = currentTrafficSample(venue.day_raw, localIndex);

  return {
    id,
    provider: 'besttime',
    name,
    category: text(venue.venue_type) ?? text(info?.venue_type) ?? 'OTHER',
    location: { lat, lng },
    address: text(venue.venue_address) ?? text(info?.venue_address),
    openNow: openDuringLocalHour(venue, localHour),
    closesMinutes: closingMinutes(venue, localHour),
    distanceMeters: haversineMeters(origin, { lat, lng }),
    rating: rating && rating > 0 ? rating : undefined,
    reviewCount: reviewCount && reviewCount > 0 ? reviewCount : undefined,
    priceLevel: priceLevel && priceLevel > 0 ? priceLevel : undefined,
    expectedBusyness,
    dwellMinutes,
    metadata: {
      forecast: venue.forecast,
      dayInt: venue.day_int,
      openStatusResolution: localHour === undefined ? 'unknown' : 'current-hour',
      trafficSampleIndex: expectedBusyness === undefined ? undefined : localIndex,
    },
  };
}

export class BestTimeVenueProvider implements VenueFactsProvider {
  readonly id = 'besttime';

  constructor(private readonly apiKey = process.env.BESTTIME_API_KEY_PRIVATE ?? '') {}

  async search(input: VenueSearchInput): Promise<VenueCandidate[]> {
    if (!this.apiKey) throw new Error('BestTime is not configured.');

    const params = new URLSearchParams({
      api_key_private: this.apiKey,
      lat: input.location.lat.toFixed(3),
      lng: input.location.lng.toFixed(3),
      radius: String(Math.max(250, Math.min(25_000, Math.round(input.radiusMeters)))),
      now: 'true',
      foot_traffic: 'both',
      own_venues_only: 'false',
      order_by: 'reviews',
      order: 'desc',
      limit: String(Math.max(1, Math.min(50, input.limit ?? 30))),
      page: '0',
    });

    const types = requestedTypes(input.categories);
    if (types.length) params.set('types', types.join(','));

    const response = await fetch(`https://besttime.app/api/v1/venues/filter?${params}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) throw new Error(`BestTime request failed with status ${response.status}.`);
    const payload: unknown = await response.json();
    const root = record(payload);
    if (!root) throw new Error('BestTime returned an invalid response.');
    if (text(root.status)?.toLocaleLowerCase() === 'error') {
      throw new Error(text(root.message) ?? 'BestTime could not complete the venue request.');
    }
    if (!Array.isArray(root.venues)) {
      throw new Error('BestTime returned an invalid venue container.');
    }

    const window = record(root.window);
    const localHour = number(window?.time_local);
    const localIndex = number(window?.time_local_index);
    return root.venues
      .map((venue) => parseBestTimeVenue(venue, input.location, localHour, localIndex))
      .filter((venue): venue is VenueCandidate => venue !== null)
      .slice(0, input.limit ?? 30);
  }
}
