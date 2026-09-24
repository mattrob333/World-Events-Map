import type { SearchHit } from './catalog';

/**
 * "Make it searchable": a place that is not on the editorial calendar can still
 * become a trip. The search boxes offer "Plan a trip to “{query}”", which opens
 * the on-device trip designer with the place filled in. Nothing is created and
 * no paid research runs until the traveler asks for it.
 */
export interface PlanPlace {
  place: string;
  region?: string;
}

// Letters (any script), spaces and the punctuation place names use. No digits,
// no markup, no URLs.
const PLACE_SHAPE = /^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()-]*$/u;

/** A search query that reads like a place name, split into place and region. */
export function planPlaceFromQuery(raw: string): PlanPlace | null {
  const query = raw.replace(/\s+/g, ' ').trim();
  if (query.length < 2 || query.length > 80) return null;
  if (!PLACE_SHAPE.test(query)) return null;
  if (query.split(' ').length > 6) return null;
  const [place, ...rest] = query.split(',').map((part) => part.trim()).filter(Boolean);
  if (!place || place.replace(/[^\p{L}]/gu, '').length < 2) return null;
  const region = rest.join(', ');
  return { place: place.slice(0, 60), ...(region ? { region: region.slice(0, 60) } : {}) };
}

/** The designer link for a place, e.g. /trips/designer?place=Munich&region=Germany. */
export function planTripHref({ place, region }: PlanPlace): string {
  const params = new URLSearchParams({ place });
  if (region) params.set('region', region);
  return `/trips/designer?${params.toString()}`;
}

/** Hits that mean the calendar already knows this place or occasion. */
const CALENDAR_GROUPS = new Set<SearchHit['group']>(['destinations', 'events']);

/**
 * The plan-a-trip offer for a query, or null when the query does not look like a
 * place or the editorial calendar already matches it (existing results win).
 */
export function planTripOffer(query: string, hits: readonly SearchHit[]): (PlanPlace & { href: string; label: string }) | null {
  const plan = planPlaceFromQuery(query);
  if (!plan) return null;
  if (hits.some((hit) => CALENDAR_GROUPS.has(hit.group))) return null;
  const label = plan.region ? `${plan.place}, ${plan.region}` : plan.place;
  return { ...plan, label, href: planTripHref(plan) };
}

/** Reads ?place= and ?region= for the designer. Same shape rules as the search box. */
export function planPlaceFromParams(params: URLSearchParams): PlanPlace | null {
  const place = params.get('place') ?? '';
  const region = params.get('region') ?? '';
  const parsed = planPlaceFromQuery(place);
  if (!parsed) return null;
  const regionParsed = region ? planPlaceFromQuery(region) : null;
  const regionText = regionParsed ? [regionParsed.place, regionParsed.region].filter(Boolean).join(', ') : parsed.region;
  return { place: parsed.place, ...(regionText ? { region: regionText.slice(0, 60) } : {}) };
}
