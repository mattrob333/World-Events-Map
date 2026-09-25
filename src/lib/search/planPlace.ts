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
  /** "YYYY-MM-DD" the traveler said, or an event's first day. Prefills the start date. */
  start?: string;
  /** Nights the traveler said. Prefills the length. */
  nights?: number;
  /** Who they said is coming ("2 families of 4 (8 people)"), shown as a reminder while adding the crew. */
  who?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PLAN_NIGHTS = 30;

// Letters (any script), spaces and the punctuation place names use. No digits,
// no markup, no URLs.
const PLACE_SHAPE = /^[\p{L}\p{M}][\p{L}\p{M}\s.,'’()-]*$/u;

/** A search query that reads like a place name, split into place and region. */
export function planPlaceFromQuery(raw: string): PlanPlace | null {
  const query = raw.replace(/\s+/g, ' ').trim();
  if (query.length < 2 || query.length > 80) return null;
  if (!PLACE_SHAPE.test(query)) return null;
  if (query.split(' ').length > 6) return null;
  if (!looksLikePlace(query)) return null;
  const [place, ...rest] = query.split(',').map((part) => part.trim()).filter(Boolean);
  if (!place || place.replace(/[^\p{L}]/gu, '').length < 2) return null;
  const region = rest.join(', ');
  return { place: place.slice(0, 60), ...(region ? { region: region.slice(0, 60) } : {}) };
}

/** The designer link for a place, e.g. /trips/designer?place=Munich&region=Germany. */
const WHO_SHAPE = /^[\p{L}\p{N} ,()'’-]{2,60}$/u;

export function planTripHref({ place, region, start, nights, who }: PlanPlace): string {
  const params = new URLSearchParams({ place });
  if (region) params.set('region', region);
  if (start && ISO_DAY.test(start)) params.set('start', start);
  if (nights && Number.isInteger(nights) && nights >= 1 && nights <= MAX_PLAN_NIGHTS) params.set('nights', String(nights));
  if (who && WHO_SHAPE.test(who)) params.set('who', who);
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
  const start = params.get('start') ?? '';
  const nights = Number(params.get('nights') ?? '');
  return {
    place: parsed.place,
    ...(regionText ? { region: regionText.slice(0, 60) } : {}),
    ...(ISO_DAY.test(start) && !Number.isNaN(Date.parse(`${start}T00:00:00Z`)) ? { start } : {}),
    ...(Number.isInteger(nights) && nights >= 1 && nights <= MAX_PLAN_NIGHTS ? { nights } : {}),
    ...(WHO_SHAPE.test(params.get('who') ?? '') ? { who: params.get('who')! } : {}),
  };
}

/**
 * A soft check that a typed place is a place: letters, a vowel in each word,
 * no long consonant runs or keyboard mashing. Real names still pass
 * ("Szczecin", "Llanfairpwllgwyngyll", "São Paulo", "東京").
 */
export function looksLikePlace(value: string): boolean {
  const text = value.normalize('NFC').trim();
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters < 2 || letters < text.replace(/\s/g, '').length * 0.6) return false;
  if (/https?:|www\.|@|[<>{}]/i.test(text)) return false;
  if (/asdf|qwer|zxcv|hjkl|sdfg|dfgh|xcvb|uiop/i.test(text)) return false;
  return text
    .split(/[\s,.'’-]+/)
    .filter((word) => /^[a-z]+$/i.test(word))
    .every(
      (word) =>
        word.length < 3 ||
        // "w" counts as a vowel in Welsh names ("Cwm"), but a longer word with no a/e/i/o/u/y is a keyboard mash ("qwzxv").
        (/[aeiouyw]/i.test(word) && !/[^aeiouyw\s]{6,}/i.test(word) && (word.length < 5 || /[aeiouy]/i.test(word))),
    );
}
