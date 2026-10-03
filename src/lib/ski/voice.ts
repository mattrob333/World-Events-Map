import { addDays, isIsoDate, type TripWindow } from './window';
import type { SkiRange, SkiResort } from './types';

/** "Utah’s Wasatch" → "utahs wasatch"; ski-ish filler words dropped so "Aspen Mountain" finds "Aspen Snowmass". */
export function normalName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(?:the|ski|resort|resorts|area|mountain|mountains|mtn)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Everything a spoken name could mean: an exact name wins on its own;
 * otherwise every item whose name (or place) contains it, or is contained in
 * it. "the Alps" is all four Alps ranges; "Aspen" is Aspen Snowmass.
 */
export function findByName<T>(items: readonly T[], said: string, names: (item: T) => string[]): T[] {
  const wanted = normalName(said);
  if (wanted.length < 2) return [];
  const exact = items.filter((item) => names(item).some((name) => normalName(name) === wanted));
  if (exact.length) return exact;
  return items.filter((item) =>
    names(item).some((name) => {
      const have = normalName(name);
      return have.length >= 2 && (have.includes(wanted) || (have.length >= 4 && wanted.includes(have)));
    }),
  );
}

export const rangeNames = (range: SkiRange) => [range.name, range.id.replace(/-/g, ' '), range.where];
export const resortNames = (resort: SkiResort) => [resort.name, resort.place, resort.name.split(':')[0] ?? resort.name];

export type WindowArgs = { from?: unknown; to?: unknown; nights?: unknown };

/**
 * The window a spoken ask sets, on top of what's there. Dates must be real;
 * a back-by date before the leave date is moved to it; a stay is 2 to 14
 * nights. Returns an error for the voice to say when nothing usable came.
 */
export function windowFromArgs(current: TripWindow, args: WindowArgs, today: string): TripWindow | { error: string } {
  const next = { ...current };
  let changed = false;
  if (typeof args.from === 'string' && isIsoDate(args.from)) {
    next.from = args.from < today ? today : args.from;
    changed = true;
  }
  if (typeof args.to === 'string' && isIsoDate(args.to)) {
    next.to = args.to;
    changed = true;
  }
  if (typeof args.nights === 'number' && Number.isFinite(args.nights)) {
    next.nights = Math.max(2, Math.min(14, Math.round(args.nights)));
    changed = true;
  }
  if (!changed) return { error: 'Error: give dates as YYYY-MM-DD, or a number of nights.' };
  if (next.to < today) return { error: 'Error: those dates are in the past.' };
  if (next.to < next.from) next.to = next.from;
  // A window shorter than the stay has no weeks to suggest: make it at least the stay long.
  if (addDays(next.from, next.nights) > next.to) next.to = addDays(next.from, next.nights);
  return next;
}

const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const NIGHT_WORDS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };

/**
 * A typed ski ask, read for the planner: the first and last month named
 * become the window ("January through March" is Jan 1 to Mar 31, in the next
 * season if that's past), a length becomes nights, and kids mean family.
 * Only what was said; nothing is guessed.
 */
export function skiAskFromText(text: string, today: string): WindowArgs & { party?: 'family' | 'crew' } {
  const out: WindowArgs & { party?: 'family' | 'crew' } = {};
  const months = [...text.matchAll(MONTH_RE)]
    // "we may go" isn't the month.
    .filter((match) => match[1] !== 'may')
    .map((match) => MONTH_KEYS.indexOf(match[1]!.slice(0, 3).toLowerCase()))
    .filter((index) => index >= 0);
  if (months.length) {
    const [ty, tm] = today.split('-').map(Number) as [number, number];
    const first = months[0]!;
    const last = months[months.length - 1]!;
    // A month already behind us this year means next year's.
    const startYear = first + 1 < tm ? ty + 1 : ty;
    const endYear = last < first ? startYear + 1 : startYear;
    const pad = (n: number) => String(n).padStart(2, '0');
    out.from = `${startYear}-${pad(first + 1)}-01`;
    out.to = `${endYear}-${pad(last + 1)}-${pad(new Date(Date.UTC(endYear, last + 1, 0)).getUTCDate())}`;
  }
  const length = /\b(\d{1,2}|three|four|five|six|seven|ten|a)\s+(nights?|days?|weeks?)\b/i.exec(text);
  if (length) {
    const raw = length[1]!.toLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : raw === 'a' ? 1 : NIGHT_WORDS[raw] ?? 0;
    const unit = length[2]!.toLowerCase();
    const nights = unit.startsWith('week') ? n * 7 : unit.startsWith('day') ? n - 1 : n;
    if (nights >= 2) out.nights = Math.min(14, nights);
  }
  if (/\b(?:kids?|children|family|son|daughter)\b/i.test(text)) out.party = 'family';
  else if (/\b(?:adults?|crew|friends|the boys|the girls|couple)\b/i.test(text)) out.party = 'crew';
  return out;
}
