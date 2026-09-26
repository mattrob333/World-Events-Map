/**
 * Share a trip without an account: the whole draft (timeline + votes) rides
 * in the link's #fragment, which browsers never send to a server. Friends
 * open it, vote, and send a small "my picks" link back that merges into the
 * organizer's copy. Live multi-phone sync needs accounts and a shared table,
 * which is not built yet.
 *
 * Links are untrusted input: everything decoded here is rebuilt field by
 * field into prototype-free maps, ids that name Object.prototype members are
 * refused, card links must point at the sites the app itself links to, colors
 * must be hex, and invisible control/format characters are stripped from text.
 *
 * What an invite carries (and the InvitePanel disclosure lists exactly this):
 * traveler names, kids' ages, home city, the plan, and everyone's votes so
 * far. Interest tags, adults' ages, music taste and taste-derived card copy
 * stay on the organizer's device, except in a self-handoff link
 * (`{ handoff: true, includeTaste: true }`) that an AI agent hands to the
 * traveler it planned for.
 */

import { DESTINATION_INDEX, SLOT_META, type CardMedia, type DesignerCard, type DestinationId, type SlotKind } from './catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, isIsoDate, nextParticipantStyle, resolveDestination, type Day, type Itinerary, type Participant, type Slot } from './itinerary';
import type { PlaceSpec } from './place';
import type { TasteInput } from './scene';
import type { TripVotes } from './votes';

/** `handoff` marks a trip an AI agent built for the traveler: opening it makes them the organizer, not a guest. */
export type SharedTrip = { trip: Itinerary; votes: TripVotes; from?: string; handoff?: boolean; organizer?: string };
export type TripReply = {
  tripId: string;
  participant: Participant;
  votes: Record<string, Record<string, 1 | -1>>;
  /** When the picks link was made (ISO). Older links than one already merged are skipped by default. */
  at?: string;
  /** Which trip, for a device that doesn't have it: shown, never trusted. */
  place?: string;
  startDate?: string;
};

export type LinkErrorKind = 'empty' | 'too-long' | 'not-ours' | 'incomplete' | 'too-large' | 'unsupported' | 'newer' | 'damaged';

/** A link that can't be opened. `message` is plain language and never a raw browser exception. */
export class LinkError extends Error {
  readonly kind: LinkErrorKind;
  constructor(kind: LinkErrorKind, message: string) {
    super(message);
    this.name = 'LinkError';
    this.kind = kind;
  }
}

const INCOMPLETE = 'This link is incomplete — it was probably cut off when copied.';

const MAX_LINK_CHARS = 60_000;
/** Inflated payload cap. Real trips are ~10–30 KB; inflation stops as soon as this is passed. */
export const MAX_JSON_BYTES = 400_000;
const SLOT_KINDS = new Set(Object.keys(SLOT_META));
const MEDIA = new Set<CardMedia>(['photo', 'video', 'reel', 'poster']);
const HEX = /^#[0-9a-f]{3,8}$/i;
const ID_SHAPE = /^[a-z0-9:_-]{1,48}$/i;

/** Ids become object keys; names like `__proto__`, `constructor` or `toString` would reach Object.prototype. */
export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && ID_SHAPE.test(value) && !(value in Object.prototype) && value !== 'prototype';
}

/** A map with no prototype: a hostile key can never reach Object.prototype through it. */
function dict<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

// --- encoding ----------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(text) || text.length % 4 === 1) throw new LinkError('incomplete', INCOMPLETE);
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    throw new LinkError('incomplete', INCOMPLETE);
  }
}

async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Inflates chunk by chunk and stops the moment the output passes `cap`, so a deflate bomb costs milliseconds. */
async function inflateCapped(bytes: Uint8Array, cap: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > cap) {
        reader.cancel().catch(() => undefined);
        throw new LinkError('too-large', 'That trip is too large to open.');
      }
      chunks.push(value);
    }
  } catch (cause) {
    if (cause instanceof LinkError) throw cause;
    throw new LinkError('incomplete', INCOMPLETE);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** "z" + deflate-raw when the browser can compress; "j" + plain JSON otherwise. */
export async function packPayload(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream === 'function') return `z${toBase64Url(await compress(bytes))}`;
  return `j${toBase64Url(bytes)}`;
}

export async function unpackPayload(packed: string): Promise<unknown> {
  if (!packed) throw new LinkError('empty', 'This link has no trip in it.');
  if (packed.length > MAX_LINK_CHARS) throw new LinkError('too-long', 'That link is too long to be a dope.travel trip.');
  const kind = packed[0];
  if (kind !== 'z' && kind !== 'j') throw new LinkError('not-ours', 'That isn’t a dope.travel trip link.');
  let bytes = fromBase64Url(packed.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new LinkError('unsupported', 'This browser can’t open compressed trip links. Try a current Chrome, Safari or Firefox.');
    bytes = await inflateCapped(bytes, MAX_JSON_BYTES);
  } else if (bytes.byteLength > MAX_JSON_BYTES) {
    throw new LinkError('too-large', 'That trip is too large to open.');
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new LinkError('incomplete', INCOMPLETE);
  }
}

// --- sanitizing --------------------------------------------------------------

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw | undefined => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : undefined);
const arr = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const own = (value: unknown): [string, unknown][] => Object.entries(obj(value) ?? {});

const PICTOGRAPH = /\p{Extended_Pictographic}/u;
/**
 * Drops Unicode control (Cc) and format (Cf) characters: bidi overrides that
 * make "‮yaM" render as "May", zero-width spaces that make "Maya​"
 * look like "Maya", and newlines in names. A zero-width joiner between two
 * emoji is kept so 👩‍🚀 stays one glyph.
 */
export function cleanText(value: string): string {
  const chars = [...value];
  return chars
    .filter((char, index) => {
      if (!/[\p{Cc}\p{Cf}]/u.test(char)) return true;
      if (char !== '‍') return false;
      const before = chars[index - 1] === '️' ? chars[index - 2] : chars[index - 1];
      return Boolean(before && PICTOGRAPH.test(before) && chars[index + 1] && PICTOGRAPH.test(chars[index + 1]));
    })
    .join('');
}

const str = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const text = cleanText(value).trim();
  return text ? [...text].slice(0, max).join('').trim() : undefined;
};
const id = (value: unknown): string | undefined => (isSafeId(value) ? value : undefined);
const hex = (value: unknown, fallback: string): string => (typeof value === 'string' && HEX.test(value) ? value : fallback);

/**
 * The only places a shared card may link to: the sites the app itself builds
 * links for (place.ts, catalog.ts, stays.ts, scene.ts). Exact hosts, no
 * suffix matching, and path prefixes that avoid the hosts' open redirects
 * (google.com/url, youtube.com/redirect). Labels are rebuilt from the host so
 * a link can't call itself "Sign in to dope.travel".
 */
const LINK_HOSTS: Record<string, { paths: string[]; label: string; keepLabel?: RegExp }> = {
  'www.google.com': { paths: ['/maps/', '/maps?'], label: 'Search Maps' },
  'maps.google.com': { paths: ['/maps/', '/maps?', '/?q='], label: 'Search Maps' },
  'www.youtube.com': { paths: ['/results', '/watch', '/@', '/shorts/'], label: 'Watch on YouTube' },
  'www.instagram.com': { paths: ['/explore/', '/reel/', '/p/'], label: 'Instagram', keepLabel: /^#[\p{L}\p{N}_]{1,30} on Instagram$/u },
  'www.tiktok.com': { paths: ['/@', '/tag/', '/search'], label: 'TikTok' },
  'open.spotify.com': { paths: ['/playlist/', '/artist/', '/album/', '/track/'], label: 'Spotify' },
  'www.airbnb.com': { paths: ['/s/'], label: 'Airbnb' },
  'www.vrbo.com': { paths: ['/search'], label: 'Vrbo' },
  'www.booking.com': { paths: ['/searchresults'], label: 'Booking.com' },
  'www.hostelworld.com': { paths: ['/search'], label: 'Hostelworld' },
  'www.ticketmaster.com': { paths: ['/search', '/event/', '/discover/'], label: 'Ticketmaster' },
  'www.bandsintown.com': { paths: ['/'], label: 'Bandsintown' },
};

export function safeCardLink(value: unknown): DesignerCard['link'] {
  const raw = obj(value);
  const href = typeof raw?.href === 'string' && raw.href.length <= 600 ? raw.href.trim() : undefined;
  if (!href) return undefined;
  try {
    const url = new URL(href);
    const rule = Object.hasOwn(LINK_HOSTS, url.hostname) ? LINK_HOSTS[url.hostname] : undefined;
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !rule) return undefined;
    const path = `${url.pathname}${url.search}`;
    if (!rule.paths.some((prefix) => path.startsWith(prefix))) return undefined;
    const label = str(raw?.label, 40);
    return { href: url.toString(), label: label && rule.keepLabel?.test(label) ? label : rule.label };
  } catch {
    return undefined;
  }
}

function cleanCard(value: unknown): DesignerCard | undefined {
  const raw = obj(value);
  const cardId = id(raw?.id);
  const title = str(raw?.title, 90);
  if (!raw || !cardId?.startsWith('custom:') || !title) return undefined;
  const slots = arr(raw.slots, 9).filter((slot): slot is SlotKind => typeof slot === 'string' && SLOT_KINDS.has(slot));
  const palette = arr(raw.palette, 2);
  return {
    id: cardId,
    destination: 'custom',
    slots,
    title,
    blurb: str(raw.blurb, 200) ?? '',
    media: MEDIA.has(raw.media as CardMedia) ? (raw.media as CardMedia) : 'poster',
    palette: [hex(palette[0], '#f26b2a'), hex(palette[1], '#8e4db8')],
    emoji: str(raw.emoji, 8) ?? '✨',
    tags: arr(raw.tags, 12).filter((tag): tag is string => typeof tag === 'string' && /^[a-z-]{1,24}$/.test(tag)),
    link: safeCardLink(raw.link),
  };
}

function cleanPlace(value: unknown): PlaceSpec | undefined {
  const raw = obj(value);
  const name = str(raw?.name, 60);
  if (!name) return undefined;
  const kind = raw?.kind === 'ski' || raw?.kind === 'beach' ? raw.kind : 'city';
  return { name, region: str(raw?.region, 60), kind };
}

function cleanParticipant(value: unknown, index: number): Participant | undefined {
  const raw = obj(value);
  const name = str(raw?.name, 30);
  const personId = id(raw?.id);
  if (!raw || !name || !personId) return undefined;
  const age = typeof raw.age === 'number' && raw.age >= 0 && raw.age <= 110 ? Math.round(raw.age) : undefined;
  return {
    id: personId,
    name,
    kind: raw.kind === 'kid' ? 'kid' : 'adult',
    age,
    emoji: str(raw.emoji, 8) ?? '😎',
    color: hex(raw.color, ['#f97316', '#06b6d4', '#a855f7', '#22c55e'][index % 4]),
    tags: arr(raw.tags, 16).filter((tag): tag is string => typeof tag === 'string' && /^[a-z][a-z-]{1,23}$/.test(tag)),
  };
}

function cleanTaste(value: unknown): TasteInput | undefined {
  const raw = obj(value);
  if (!raw) return undefined;
  const words = (list: unknown, max: number) => arr(list, max).map((item) => str(item, 60)).filter((item): item is string => Boolean(item));
  const genres = words(raw.genres, 24);
  const topArtists = words(raw.topArtists, 12);
  if (!genres.length && !topArtists.length) return undefined;
  const eras = arr(raw.eras, 8)
    .map((era) => obj(era))
    .filter((era): era is Raw => Boolean(era && typeof era.decade === 'string' && /^\d{4}s$/.test(era.decade) && typeof era.share === 'number' && era.share >= 0 && era.share <= 1))
    .map((era) => ({ decade: era.decade as string, share: era.share as number }));
  const energy = raw.energy === 'high' || raw.energy === 'chill' || raw.energy === 'mixed' ? raw.energy : undefined;
  return { genres, topArtists, ...(eras.length ? { eras } : {}), ...(energy ? { energy } : {}) };
}

export function cleanVotes(value: unknown): TripVotes {
  const votes = dict<Record<string, Record<string, 1 | -1>>>();
  for (const [slotId, slotRaw] of own(value).slice(0, 200)) {
    if (!isSafeId(slotId)) continue;
    for (const [cardId, cardRaw] of own(slotRaw).slice(0, 40)) {
      if (!isSafeId(cardId)) continue;
      for (const [personId, vote] of own(cardRaw).slice(0, MAX_PARTICIPANTS + 10)) {
        if (!isSafeId(personId) || (vote !== 1 && vote !== -1)) continue;
        const slot = (votes[slotId] ??= dict());
        (slot[cardId] ??= dict())[personId] = vote;
      }
    }
  }
  return votes;
}

export function sanitizeTrip(value: unknown): Itinerary {
  const raw = obj(value);
  if (!raw) throw new LinkError('damaged', 'That trip link is damaged.');
  const tripId = id(raw.id);
  const destination = raw.destination === 'custom' || DESTINATION_INDEX.has(raw.destination as DestinationId) ? (raw.destination as Itinerary['destination']) : undefined;
  const place = cleanPlace(raw.place);
  const startDate = typeof raw.startDate === 'string' && isIsoDate(raw.startDate) ? raw.startDate : undefined;
  const nights = Number(raw.nights);
  if (!tripId || !destination || !startDate || !Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) throw new LinkError('damaged', 'That trip link is damaged.');
  if (destination === 'custom' && !place) throw new LinkError('damaged', 'That trip link is missing its destination.');
  const seen = new Set<string>();
  const participants = arr(raw.participants, MAX_PARTICIPANTS + 10)
    .map(cleanParticipant)
    .filter((p): p is Participant => Boolean(p) && !seen.has(p!.id) && Boolean(seen.add(p!.id)))
    .slice(0, MAX_PARTICIPANTS);
  if (!participants.length) throw new LinkError('damaged', 'That trip has nobody on it.');
  const cards = destination === 'custom' ? arr(raw.cards, 60).map(cleanCard).filter((c): c is DesignerCard => Boolean(c)) : undefined;
  const days: Day[] = arr(raw.days, MAX_NIGHTS + 1).map((dayRaw, index) => {
    const day = obj(dayRaw) ?? {};
    const slots: Slot[] = arr(day.slots, 9)
      .map((slotRaw): Slot | undefined => {
        const slot = obj(slotRaw);
        const slotId = id(slot?.id);
        if (!slot || !slotId || !SLOT_KINDS.has(slot.kind as string)) return undefined;
        const kind = slot.kind as SlotKind;
        return {
          id: slotId,
          kind,
          label: str(slot.label, 40) ?? SLOT_META[kind].label,
          time: str(slot.time, 16) ?? SLOT_META[kind].time,
          cardIds: arr(slot.cardIds, 12).filter((c): c is string => isSafeId(c)),
          note: str(slot.note, 200),
        };
      })
      .filter((slot): slot is Slot => Boolean(slot));
    return {
      index,
      date: typeof day.date === 'string' && isIsoDate(day.date) ? day.date : startDate,
      title: str(day.title, 80) ?? `Day ${index + 1}`,
      hype: str(day.hype, 240) ?? '',
      slots,
    };
  });
  return {
    id: tripId,
    destination,
    ...(destination === 'custom' ? { place, cards } : {}),
    startDate,
    nights,
    hometown: str(raw.hometown, 60),
    participants,
    days,
    engine: raw.engine === 'claude' ? 'claude' : 'on-device',
    createdAt: typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt)) ? raw.createdAt : new Date(0).toISOString(),
  };
}

// --- privacy -----------------------------------------------------------------

/** Card copy that scene.ts writes from someone's listening ("Because you listen to…"). */
const TASTE_BLURB = /because you listen|top songs|you love the classics|in your mix|your (music|playlist|listening)/i;
export const NEUTRAL_NIGHT_BLURB = 'A night out for the group.';

/**
 * What an invite is allowed to carry. Taste-derived card copy is replaced with
 * neutral copy; interest tags and adults' ages are dropped (kids' ages stay:
 * they size the stay searches); music taste and the guest marker never travel.
 */
export function shareableTrip(trip: Itinerary): Itinerary {
  const shared: Itinerary = {
    ...trip,
    participants: trip.participants.map((person) => ({
      id: person.id,
      name: person.name,
      kind: person.kind,
      ...(person.kind === 'kid' && person.age !== undefined ? { age: person.age } : {}),
      emoji: person.emoji,
      color: person.color,
      tags: [],
    })),
    ...(trip.cards ? { cards: trip.cards.map((card) => (TASTE_BLURB.test(card.blurb) ? { ...card, blurb: NEUTRAL_NIGHT_BLURB } : card)) } : {}),
  };
  delete shared.taste;
  delete shared.joinedFrom;
  return shared;
}

// --- links -------------------------------------------------------------------

export type TripLinkOptions = {
  /** An agent-built trip for the traveler: opening it makes them the organizer. */
  handoff?: boolean;
  /**
   * Only for a self-handoff (the traveler's own AI agent handing them their
   * trip, e.g. MCP `dope_plan_trip`): keeps music taste, interest tags, adults'
   * ages and taste-derived copy. Ignored unless `handoff` is also true.
   */
  includeTaste?: boolean;
};

/** Everything after `#` that names who a link is from, so a cut-off link can still say who to ask. */
function hintParam(name?: string): string {
  const clean = name ? str(name, 30) : undefined;
  return clean ? `f=${encodeURIComponent(clean)}&` : '';
}

/** Reads the `f=` hint (the sender's name) from a fragment even when the rest is cut off. */
export function linkHint(fragment: string): string | undefined {
  try {
    return str(new URLSearchParams(fragment.replace(/^#/, '')).get('f') ?? undefined, 30);
  } catch {
    return undefined;
  }
}

/**
 * The share link. By default it carries names, kids' ages, home city, the
 * plan and everyone's votes so far; the organizer (the first traveler) is
 * marked so guests can't pick them.
 */
export async function tripLink(origin: string, trip: Itinerary, votes: TripVotes, from?: string, options: TripLinkOptions = {}): Promise<string> {
  const selfHandoff = options.handoff === true && options.includeTaste === true;
  const shared = selfHandoff ? { ...trip } : shareableTrip(trip);
  if (selfHandoff) delete shared.joinedFrom;
  const payload = {
    v: 1,
    trip: shared,
    votes,
    from,
    ...(options.handoff ? { handoff: true } : { organizer: trip.participants[0]?.id }),
  };
  return `${origin}/trips/join#${options.handoff ? '' : hintParam(from)}t=${await packPayload(payload)}`;
}

export async function readTripLink(packed: string): Promise<SharedTrip> {
  const raw = obj(await unpackPayload(packed));
  if (!raw || raw.v !== 1) throw new LinkError('newer', 'That trip link is from a newer version of dope.travel.');
  const handoff = raw.handoff === true;
  const trip = sanitizeTrip(raw.trip);
  // Taste only rides in a self-handoff; anywhere else it is ignored.
  const taste = handoff ? cleanTaste(obj(raw.trip)?.taste) : undefined;
  const organizer = !handoff && typeof raw.organizer === 'string' && trip.participants.some((p) => p.id === raw.organizer) ? raw.organizer : undefined;
  return { trip: taste ? { ...trip, taste } : trip, votes: cleanVotes(raw.votes), from: str(raw.from, 30), handoff, ...(organizer ? { organizer } : {}) };
}

/** Only this traveler's own votes go back to the organizer, stamped with the time and which trip. */
export function replyFor(trip: Itinerary, votes: TripVotes, participantId: string, at: Date = new Date()): TripReply {
  const participant = trip.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Pick who you are first.');
  const mine: TripReply['votes'] = dict();
  for (const [slotId, slot] of Object.entries(votes)) {
    for (const [cardId, cardVotes] of Object.entries(slot)) {
      const value = Object.hasOwn(cardVotes, participantId) ? cardVotes[participantId] : undefined;
      if (value) (mine[slotId] ??= dict())[cardId] = value;
    }
  }
  const { tags: _tags, age, ...rest } = participant;
  void _tags;
  return {
    tripId: trip.id,
    participant: { ...rest, tags: [], ...(participant.kind === 'kid' && age !== undefined ? { age } : {}) },
    votes: mine,
    at: at.toISOString(),
    place: resolveDestination(trip)?.name,
    startDate: trip.startDate,
  };
}

export async function replyLink(origin: string, reply: TripReply): Promise<string> {
  return `${origin}/trips/join#${hintParam(reply.participant.name)}r=${await packPayload({ v: 1, ...reply })}`;
}

export async function readReplyLink(packed: string, now: Date = new Date()): Promise<TripReply> {
  const raw = obj(await unpackPayload(packed));
  const tripId = id(raw?.tripId);
  const participant = cleanParticipant(raw?.participant, 0);
  if (!raw || raw.v !== 1 || !tripId || !participant) throw new LinkError('damaged', 'That picks link is damaged.');
  const votes: TripReply['votes'] = dict();
  for (const [slotId, slotRaw] of own(raw.votes).slice(0, 200)) {
    if (!isSafeId(slotId)) continue;
    for (const [cardId, value] of own(slotRaw).slice(0, 40)) {
      if (isSafeId(cardId) && (value === 1 || value === -1)) (votes[slotId] ??= dict())[cardId] = value;
    }
  }
  // A time from the future would make every later genuine link look stale: clamp to now.
  const sent = typeof raw.at === 'string' ? Date.parse(raw.at) : Number.NaN;
  const at = Number.isNaN(sent) ? undefined : new Date(Math.min(sent, now.getTime())).toISOString();
  const startDate = typeof raw.startDate === 'string' && isIsoDate(raw.startDate) ? raw.startDate : undefined;
  return { tripId, participant, votes, ...(at ? { at } : {}), ...(str(raw.place, 60) ? { place: str(raw.place, 60) } : {}), ...(startDate ? { startDate } : {}) };
}

// --- merging -----------------------------------------------------------------

export type MergeSummary = {
  /** Loves and passes that landed on an idea still in the plan. */
  loves: number;
  passes: number;
  /** Votes for ideas no longer in the plan. */
  dropped: number;
  /** Votes the target traveler already had here that this replaces. */
  replaced: number;
  added: boolean;
  /** Whose votes these become on this device. */
  participantId: string;
  name: string;
};

const sameName = (a: string, b: string) => a.normalize('NFKC').trim().toLocaleLowerCase() === b.normalize('NFKC').trim().toLocaleLowerCase();

/** The first traveler is the organizer: the one who made the trip and sent the invite. */
export function organizerOf(trip: Pick<Itinerary, 'participants'>): Participant | undefined {
  return trip.participants[0];
}

export type ReplyCheck = {
  /** The local traveler with the reply's id, if any. */
  known?: Participant;
  /** The reply claims the organizer's own id. */
  organizer: boolean;
  /** A known id arrived with a different name. */
  nameMismatch: boolean;
  /** A new id whose name matches someone already on the trip. */
  duplicateOf?: Participant;
  /** A newer picks link from this traveler was already added. */
  newerMergedAt?: string;
  preview: MergeSummary;
};

/** Everything the organizer should see before a picks link changes anyone's votes. */
export function checkReply(trip: Itinerary, votes: TripVotes, reply: TripReply, lastMergedAt: Record<string, string> = {}): ReplyCheck {
  const known = trip.participants.find((p) => p.id === reply.participant.id);
  const duplicateOf = known ? undefined : trip.participants.find((p) => sameName(p.name, reply.participant.name));
  const merged = Object.hasOwn(lastMergedAt, reply.participant.id) ? lastMergedAt[reply.participant.id] : undefined;
  const newer = merged && reply.at && Date.parse(reply.at) < Date.parse(merged) ? merged : undefined;
  return {
    known,
    organizer: Boolean(known && known.id === organizerOf(trip)?.id),
    nameMismatch: Boolean(known && !sameName(known.name, reply.participant.name)),
    duplicateOf,
    ...(newer ? { newerMergedAt: newer } : {}),
    preview: mergeReply(trip, votes, reply).summary,
  };
}

/**
 * Merges a friend's picks into the organizer's trip. The target traveler's
 * previous votes are replaced wholesale; a vote follows its card if the
 * organizer moved it; votes for ideas no longer in the plan are counted as
 * dropped; a new traveler is added (up to the party limit) with a style no one
 * else on the trip has. `as` merges into an existing traveler instead (the
 * organizer said a same-name newcomer is that person).
 */
export function mergeReply(trip: Itinerary, votes: TripVotes, reply: TripReply, options: { as?: string } = {}): { trip: Itinerary; votes: TripVotes; added: boolean; summary: MergeSummary } {
  if (reply.tripId !== trip.id) throw new Error('Those picks are for a different trip.');
  const target = options.as ? trip.participants.find((p) => p.id === options.as) : trip.participants.find((p) => p.id === reply.participant.id);
  if (options.as && !target) throw new Error('That traveler isn’t on this trip anymore.');
  if (!target && trip.participants.length >= MAX_PARTICIPANTS) throw new Error(`Trips can have up to ${MAX_PARTICIPANTS} travelers.`);
  const whoId = target?.id ?? reply.participant.id;
  if (!isSafeId(whoId)) throw new Error('That picks link is damaged.');
  if ((target ?? reply.participant).kind === 'kid' && trip.participants.some((p) => p.kind !== 'kid')) throw new Error('Kids come along but don’t vote, so there’s nothing to add from this link.');
  let newcomer: Participant | undefined;
  if (!target) {
    const clash = trip.participants.some((p) => p.color.toLowerCase() === reply.participant.color.toLowerCase() || p.emoji === reply.participant.emoji);
    newcomer = { ...reply.participant, tags: [], ...(clash ? nextParticipantStyle(trip.participants) : {}) };
  }
  const nextTrip = newcomer ? { ...trip, participants: [...trip.participants, newcomer] } : trip;
  let replaced = 0;
  const next: TripVotes = dict();
  for (const [slotId, slot] of Object.entries(votes)) {
    for (const [cardId, cardVotes] of Object.entries(slot)) {
      const rest = dict<1 | -1>();
      for (const [personId, value] of Object.entries(cardVotes)) {
        if (personId === whoId) replaced += 1;
        else rest[personId] = value;
      }
      (next[slotId] ??= dict())[cardId] = rest;
    }
  }
  const allSlots = trip.days.flatMap((d) => d.slots);
  const slotHas = new Set(allSlots.flatMap((slot) => slot.cardIds.map((cardId) => `${slot.id}|${cardId}`)));
  // Ideas repeat across days, so a moved card is looked for on its original day first.
  const whereIs = (cardId: string, fromSlot: string) => {
    const day = fromSlot.match(/^d\d+-/)?.[0];
    const holders = allSlots.filter((s) => s.cardIds.includes(cardId));
    return (holders.find((s) => day && s.id.startsWith(day)) ?? holders[0])?.id;
  };
  let loves = 0;
  let passes = 0;
  let dropped = 0;
  for (const [slotId, slot] of Object.entries(reply.votes)) {
    for (const [cardId, value] of Object.entries(slot)) {
      const landing = slotHas.has(`${slotId}|${cardId}`) ? slotId : whereIs(cardId, slotId);
      if (!landing) {
        dropped += 1;
        continue;
      }
      const cardVotes = ((next[landing] ??= dict())[cardId] ??= dict());
      if (Object.hasOwn(cardVotes, whoId)) continue; // an idea repeated in one day counts once
      cardVotes[whoId] = value;
      if (value === 1) loves += 1;
      else passes += 1;
    }
  }
  return {
    trip: nextTrip,
    votes: next,
    added: Boolean(newcomer),
    summary: { loves, passes, dropped, replaced, added: Boolean(newcomer), participantId: whoId, name: (target ?? newcomer)!.name },
  };
}

/** "1 love", "2 passes", "0 picks". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
