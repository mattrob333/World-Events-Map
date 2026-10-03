import { isIsoDate, type TripWindow } from './window';

/**
 * Sharing a ski plan without accounts or a server: the shortlist rides in the
 * link's fragment (after the #, so it never reaches a server log), the people
 * you send it to vote on their phone, and their votes come back the same way,
 * as a link pasted into the group chat. Opening a reply on the device that
 * planned the trip adds the votes to it.
 *
 * Everything decoded here came from a link anyone could have edited, so it is
 * checked field by field, capped in size, and option ids are kept only when
 * they name something in the catalog.
 */

export type Level = 'range' | 'resort' | 'week';
export type VoteValue = 1 | 0 | -1;

export interface SharedPlan {
  /** The trip's id on the planner's device, so replies find their way back. */
  id: string;
  name: string;
  window: TripWindow;
  party: 'family' | 'crew';
  level: Level;
  /** Range ids, resort ids, or weeks as "resortId@YYYY-MM-DD". */
  options: string[];
  /** Who sent it, as they wrote it. */
  from: string;
}

export interface Reply {
  tripId: string;
  /** Who voted ("The Parks"). */
  by: string;
  votes: Record<string, VoteValue>;
}

const MAX_LINK = 4000;
const MAX_OPTIONS = 24;
const TEXT_MAX = 40;
const ID = /^[a-z0-9-]{1,60}$/;
const WEEK = /^([a-z0-9-]{1,60})@(\d{4}-\d{2}-\d{2})$/;
const TRIP_ID = /^[A-Za-z0-9_-]{6,24}$/;

function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(text: string): unknown {
  if (!text || text.length > MAX_LINK || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** Trim, drop control characters and cap a name someone typed. */
export function cleanText(value: unknown, max = TEXT_MAX): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function optionValid(key: string, level: Level, known: (level: Level, id: string) => boolean): boolean {
  if (level === 'week') {
    const match = WEEK.exec(key);
    return Boolean(match && isIsoDate(match[2]) && known('resort', match[1]));
  }
  return ID.test(key) && known(level, key);
}

function validWindow(raw: unknown): TripWindow | null {
  if (!raw || typeof raw !== 'object') return null;
  const { f, t, n } = raw as Record<string, unknown>;
  if (!isIsoDate(f) || !isIsoDate(t) || f > t || typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 21) return null;
  // A year at most: anything longer is a broken or hostile link.
  if (Date.parse(t) - Date.parse(f) > 366 * 86_400_000) return null;
  return { from: f, to: t, nights: n };
}

export function encodePlan(plan: SharedPlan): string {
  return encode({ v: 1, i: plan.id, n: plan.name, w: { f: plan.window.from, t: plan.window.to, n: plan.window.nights }, p: plan.party, l: plan.level, o: plan.options.slice(0, MAX_OPTIONS), b: plan.from });
}

export function decodePlan(text: string, known: (level: Level, id: string) => boolean): SharedPlan | null {
  const raw = decode(text) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  const id = typeof raw.i === 'string' && TRIP_ID.test(raw.i) ? raw.i : null;
  const window = validWindow(raw.w);
  const level = raw.l === 'range' || raw.l === 'resort' || raw.l === 'week' ? raw.l : null;
  if (!id || !window || !level || !Array.isArray(raw.o)) return null;
  const options = [...new Set(raw.o.filter((key): key is string => typeof key === 'string' && optionValid(key, level, known)))].slice(0, MAX_OPTIONS);
  if (!options.length) return null;
  return {
    id,
    name: cleanText(raw.n, 60) || 'Ski trip',
    window,
    party: raw.p === 'family' ? 'family' : 'crew',
    level,
    options,
    from: cleanText(raw.b),
  };
}

export function encodeReply(reply: Reply): string {
  return encode({ v: 1, r: reply.tripId, b: reply.by, x: reply.votes });
}

export function decodeReply(text: string, valid: (key: string) => boolean): Reply | null {
  const raw = decode(text) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  if (typeof raw.r !== 'string' || !TRIP_ID.test(raw.r)) return null;
  const by = cleanText(raw.b);
  if (!by || !raw.x || typeof raw.x !== 'object' || Array.isArray(raw.x)) return null;
  const votes: Record<string, VoteValue> = {};
  for (const [key, value] of Object.entries(raw.x as Record<string, unknown>).slice(0, MAX_OPTIONS)) {
    if ((value === 1 || value === 0 || value === -1) && valid(key)) votes[key] = value;
  }
  if (!Object.keys(votes).length) return null;
  return { tripId: raw.r, by, votes };
}

/** A short random id for a trip, from the browser's crypto. */
export function newTripId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
