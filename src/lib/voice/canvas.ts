/**
 * The Vibe canvas: what fills the screen while they talk. Places come from
 * our own ranking (calendar, news, their profile); spots come from the voice
 * backend's web searches and must carry the https page they were found on.
 * Pure functions, so the rules are tested apart from the UI.
 */

export type SpotKind = 'eat' | 'drink' | 'dance' | 'apres' | 'do' | 'event' | 'stay';
export const SPOT_KINDS: readonly SpotKind[] = ['event', 'eat', 'drink', 'apres', 'dance', 'do', 'stay'];
export const SPOT_LABEL: Record<SpotKind, string> = { event: 'On while you’re there', eat: 'Eat', drink: 'Drink', apres: 'Après', dance: 'Dance', do: 'Do', stay: 'Stay' };
export const SPOT_EMOJI: Record<SpotKind, string> = { event: '🎟️', eat: '🍽️', drink: '🍸', apres: '🥂', dance: '🪩', do: '✨', stay: '🛏️' };

export type CanvasPlace = {
  id: string;
  name: string;
  country: string;
  /** Our place index key ("resort:switzerland:zermatt"), for its photo. */
  key?: string;
  /** A calendar event there, for a curated photo. */
  eventId?: string;
  slug?: string | null;
  reason?: string;
  /** Set when the concierge marked it a best fit, with why. */
  focus?: string;
  /** Listed because it's in range, not because anything ranked it. */
  quiet?: boolean;
};

export type CanvasSpot = {
  id: string;
  name: string;
  kind: SpotKind;
  why: string;
  url: string;
  host: string;
  place: string;
  date?: string;
  /** Set on this device from their Vibe profile: how well it fits, and the concierge's line. */
  fit?: number;
  wink?: string | null;
  clash?: boolean;
};

export type Canvas = {
  places: CanvasPlace[];
  spots: CanvasSpot[];
  picked: string[];
  window?: { from: string; to: string; days: number };
  /** Everything in range, beyond what's shown, so a best-fit mark can bring one forward. */
  inRange?: { key: string; name: string; country: string }[];
};

export const EMPTY_CANVAS: Canvas = { places: [], spots: [], picked: [] };

const MAX_PLACES = 16;
const MAX_SPOTS = 60;

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const slug = (value: string) => fold(value).replace(/ /g, '-');

export function samePlace(a: string, b: string): boolean {
  const x = fold(a);
  const y = fold(b);
  return Boolean(x && y) && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `));
}

/** An https page on the open web; never our own site, never an address with credentials. */
export function sourceHost(url: unknown): string | null {
  if (typeof url !== 'string' || url.length > 500) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (!host.includes('.') || /(^|\.)dope\.travel$/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}

type RankedInput = { key: string; name: string; country: string; slug?: string | null; events?: { id: string }[]; reasons?: { text: string }[] };

/** Ranked places replace the old ranking; places the concierge focused keep their mark. */
export function withPlaces(canvas: Canvas, ranked: readonly RankedInput[], also: readonly { key: string; name: string; country: string }[] = [], window?: Canvas['window']): Canvas {
  const focus = new Map(canvas.places.filter((place) => place.focus).map((place) => [fold(place.name), place.focus!]));
  const places: CanvasPlace[] = [];
  const seen = new Set<string>();
  for (const place of ranked) {
    if (seen.has(fold(place.name))) continue;
    seen.add(fold(place.name));
    places.push({ id: `place:${slug(place.name)}`, name: place.name, country: place.country, key: place.key, eventId: place.events?.[0]?.id, slug: place.slug ?? null, reason: place.reasons?.[0]?.text, focus: focus.get(fold(place.name)) });
  }
  for (const place of also) {
    if (places.length >= MAX_PLACES || seen.has(fold(place.name))) continue;
    seen.add(fold(place.name));
    places.push({ id: `place:${slug(place.name)}`, name: place.name, country: place.country, key: place.key, quiet: true, focus: focus.get(fold(place.name)) });
  }
  return { ...canvas, places: places.slice(0, MAX_PLACES), window: window ?? canvas.window, inRange: also.slice(0, 120).map(({ key, name, country }) => ({ key, name, country })) };
}

/** One place they named that nothing ranked (a town we don't list): shown plainly. */
export function withNamedPlace(canvas: Canvas, name: string, country = ''): Canvas {
  const clean = clip(name, 60);
  if (!clean || canvas.places.some((place) => samePlace(place.name, clean))) return canvas;
  return { ...canvas, places: [{ id: `place:${slug(clean)}`, name: clean, country: clip(country, 40) }, ...canvas.places].slice(0, MAX_PLACES) };
}

/** Marks best fits; unknown names are ignored rather than invented. Returns the names it marked. */
export function withFocus(canvas: Canvas, names: readonly unknown[], why: unknown): { canvas: Canvas; marked: string[] } {
  const reason = clip(why, 90) || 'A strong fit for you';
  const wanted = names.map((name) => clip(name, 60)).filter(Boolean);
  const marked: string[] = [];
  const places = canvas.places.map((place) => {
    if (!wanted.some((name) => samePlace(place.name, name))) return place;
    marked.push(place.name);
    return { ...place, focus: reason, quiet: false };
  });
  // A best fit that's in range but wasn't shown comes forward; names we don't know stay ignored.
  for (const name of wanted) {
    if (marked.some((done) => samePlace(done, name))) continue;
    const hit = canvas.inRange?.find((place) => samePlace(place.name, name));
    if (!hit) continue;
    marked.push(hit.name);
    places.push({ id: `place:${slug(hit.name)}`, name: hit.name, country: hit.country, key: hit.key, focus: reason });
  }
  // Best fits lead.
  places.sort((a, b) => Number(Boolean(b.focus)) - Number(Boolean(a.focus)));
  return { canvas: { ...canvas, places }, marked };
}

/**
 * Adds spots the backend found: each needs a name, a known kind and an https
 * source; duplicates (same name in the same place) are skipped. Returns how
 * many landed, so the backend hears the truth.
 */
export function withSpots(canvas: Canvas, place: unknown, spots: unknown): { canvas: Canvas; added: number; rejected: number } {
  const town = clip(place, 60);
  if (!town || !Array.isArray(spots)) return { canvas, added: 0, rejected: Array.isArray(spots) ? spots.length : 0 };
  const next = [...canvas.spots];
  let added = 0;
  let rejected = 0;
  for (const raw of spots.slice(0, 6)) {
    const spot = raw as Record<string, unknown>;
    const name = clip(spot.name, 60);
    const kind = SPOT_KINDS.includes(spot.kind as SpotKind) ? (spot.kind as SpotKind) : null;
    const host = sourceHost(spot.url);
    if (!name || !kind || !host || next.length >= MAX_SPOTS) {
      rejected += 1;
      continue;
    }
    if (next.some((existing) => samePlace(existing.place, town) && fold(existing.name) === fold(name))) continue;
    const date = typeof spot.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(spot.date) ? spot.date : undefined;
    next.push({ id: `spot:${slug(town)}:${slug(name)}`, name, kind, why: clip(spot.why, 140), url: String(spot.url), host, place: town, date });
    added += 1;
  }
  let result: Canvas = { ...canvas, spots: next };
  if (added) result = withNamedPlace(result, town);
  return { canvas: result, added, rejected };
}

export function togglePick(canvas: Canvas, id: string): Canvas {
  return { ...canvas, picked: canvas.picked.includes(id) ? canvas.picked.filter((item) => item !== id) : [...canvas.picked, id] };
}

/** Where the itinerary should be: the place with the most picks, else a picked place, else the best fit. */
export function tripPlace(canvas: Canvas): CanvasPlace | null {
  const counts = new Map<string, number>();
  for (const spot of canvas.spots) if (canvas.picked.includes(spot.id)) counts.set(fold(spot.place), (counts.get(fold(spot.place)) ?? 0) + 1);
  const bySpots = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (bySpots) return canvas.places.find((place) => fold(place.name) === bySpots) ?? { id: `place:${bySpots}`, name: canvas.spots.find((spot) => fold(spot.place) === bySpots)!.place, country: '' };
  return canvas.places.find((place) => canvas.picked.includes(place.id)) ?? canvas.places.find((place) => place.focus) ?? canvas.places[0] ?? null;
}

/** The picked spots in that place, for the itinerary. */
export function pickedSpotsIn(canvas: Canvas, place: string): CanvasSpot[] {
  return canvas.spots.filter((spot) => canvas.picked.includes(spot.id) && samePlace(spot.place, place));
}

/** One line for the concierge and screen readers: what's on the canvas now. */
export function canvasSummary(canvas: Canvas): string {
  const best = canvas.places.filter((place) => place.focus).map((place) => place.name);
  const ranked = canvas.places.filter((place) => !place.quiet).slice(0, 4).map((place) => place.name);
  const parts = [ranked.length ? `Places: ${ranked.join(', ')}` : '', best.length ? `best fits ${best.join(', ')}` : '', canvas.spots.length ? `${canvas.spots.length} spots` : '', canvas.picked.length ? `${canvas.picked.length} picked` : ''];
  return parts.filter(Boolean).join('; ');
}

/** Scores every spot against a traveler, on the device (their profile never leaves it here). Best fits first. */
export function scoreSpots(canvas: Canvas, score: (spot: CanvasSpot) => { score: number; wink: string | null; conflicts: unknown[] }): Canvas {
  const spots = canvas.spots.map((spot) => {
    const match = score(spot);
    return { ...spot, fit: match.score, wink: match.wink, clash: match.conflicts.length > 0 };
  });
  return { ...canvas, spots };
}
