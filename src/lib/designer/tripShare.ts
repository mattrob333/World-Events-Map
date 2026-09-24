/**
 * Share a trip without an account: the whole draft (timeline + votes) rides
 * in the link's #fragment, which browsers never send to a server. Friends
 * open it, vote, and send a small "my picks" link back that merges into the
 * organizer's copy. Live multi-phone sync needs accounts and a shared table,
 * which is not built yet.
 *
 * Links are untrusted input: everything decoded here is rebuilt field by
 * field, card links must be https, and colors must be hex.
 */

import { DESTINATION_INDEX, SLOT_META, type CardMedia, type DesignerCard, type DestinationId, type SlotKind } from './catalog';
import { MAX_NIGHTS, MAX_PARTICIPANTS, isIsoDate, type Day, type Itinerary, type Participant, type Slot } from './itinerary';
import type { PlaceSpec } from './place';
import type { TripVotes } from './votes';

/** `handoff` marks a trip an AI agent built for the traveler: opening it makes them the organizer, not a guest. */
export type SharedTrip = { trip: Itinerary; votes: TripVotes; from?: string; handoff?: boolean };
export type TripReply = { tripId: string; participant: Participant; votes: Record<string, Record<string, 1 | -1>> };

const MAX_LINK_CHARS = 60_000;
const MAX_JSON_CHARS = 400_000;
const SLOT_KINDS = new Set(Object.keys(SLOT_META));
const MEDIA = new Set<CardMedia>(['photo', 'video', 'reel', 'poster']);
const HEX = /^#[0-9a-f]{3,8}$/i;
const ID = /^[a-z0-9:_-]{1,48}$/i;

// --- encoding ----------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** "z" + deflate-raw when the browser can compress; "j" + plain JSON otherwise. */
export async function packPayload(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream === 'function') return `z${toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')))}`;
  return `j${toBase64Url(bytes)}`;
}

export async function unpackPayload(packed: string): Promise<unknown> {
  if (!packed || packed.length > MAX_LINK_CHARS) throw new Error('That link is too long or empty.');
  const kind = packed[0];
  let bytes = fromBase64Url(packed.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser can’t open compressed trip links.');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  } else if (kind !== 'j') {
    throw new Error('That isn’t a dope.travel trip link.');
  }
  const json = new TextDecoder().decode(bytes);
  if (json.length > MAX_JSON_CHARS) throw new Error('That trip is too large to open.');
  return JSON.parse(json) as unknown;
}

// --- sanitizing --------------------------------------------------------------

type Raw = Record<string, unknown>;
const obj = (value: unknown): Raw | undefined => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Raw) : undefined);
const arr = (value: unknown, max: number): unknown[] => (Array.isArray(value) ? value.slice(0, max) : []);
const str = (value: unknown, max: number): string | undefined => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined);
const id = (value: unknown): string | undefined => (typeof value === 'string' && ID.test(value) ? value : undefined);
const hex = (value: unknown, fallback: string): string => (typeof value === 'string' && HEX.test(value) ? value : fallback);

function httpsLink(value: unknown): DesignerCard['link'] {
  const raw = obj(value);
  const href = str(raw?.href, 600);
  if (!href) return undefined;
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:') return undefined;
    return { href: url.toString(), label: str(raw?.label, 40) ?? 'Open' };
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
    link: httpsLink(raw.link),
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

function cleanVotes(value: unknown): TripVotes {
  const votes: TripVotes = {};
  for (const [slotId, slotRaw] of Object.entries(obj(value) ?? {}).slice(0, 200)) {
    if (!ID.test(slotId)) continue;
    for (const [cardId, cardRaw] of Object.entries(obj(slotRaw) ?? {}).slice(0, 40)) {
      if (!ID.test(cardId)) continue;
      for (const [personId, vote] of Object.entries(obj(cardRaw) ?? {}).slice(0, MAX_PARTICIPANTS + 10)) {
        if (!ID.test(personId) || (vote !== 1 && vote !== -1)) continue;
        ((votes[slotId] ??= {})[cardId] ??= {})[personId] = vote;
      }
    }
  }
  return votes;
}

export function sanitizeTrip(value: unknown): Itinerary {
  const raw = obj(value);
  if (!raw) throw new Error('That trip link is damaged.');
  const tripId = id(raw.id);
  const destination = raw.destination === 'custom' || DESTINATION_INDEX.has(raw.destination as DestinationId) ? (raw.destination as Itinerary['destination']) : undefined;
  const place = cleanPlace(raw.place);
  const startDate = typeof raw.startDate === 'string' && isIsoDate(raw.startDate) ? raw.startDate : undefined;
  const nights = Number(raw.nights);
  if (!tripId || !destination || !startDate || !Number.isInteger(nights) || nights < 1 || nights > MAX_NIGHTS) throw new Error('That trip link is damaged.');
  if (destination === 'custom' && !place) throw new Error('That trip link is missing its destination.');
  const participants = arr(raw.participants, MAX_PARTICIPANTS + 10)
    .map(cleanParticipant)
    .filter((p): p is Participant => Boolean(p));
  if (!participants.length) throw new Error('That trip has nobody on it.');
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
          cardIds: arr(slot.cardIds, 12).filter((c): c is string => typeof c === 'string' && ID.test(c)),
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

// --- links -------------------------------------------------------------------

/** The share link. Music taste stays on the organizer's device. */
export async function tripLink(origin: string, trip: Itinerary, votes: TripVotes, from?: string, options: { handoff?: boolean } = {}): Promise<string> {
  const shared = { ...trip };
  delete shared.taste;
  delete shared.joinedFrom;
  return `${origin}/trips/join#t=${await packPayload({ v: 1, trip: shared, votes, from, ...(options.handoff ? { handoff: true } : {}) })}`;
}

export async function readTripLink(packed: string): Promise<SharedTrip> {
  const raw = obj(await unpackPayload(packed));
  if (!raw || raw.v !== 1) throw new Error('That trip link is from a newer version of dope.travel.');
  return { trip: sanitizeTrip(raw.trip), votes: cleanVotes(raw.votes), from: str(raw.from, 30), handoff: raw.handoff === true };
}

/** Only this traveler's own votes go back to the organizer. */
export function replyFor(trip: Itinerary, votes: TripVotes, participantId: string): TripReply {
  const participant = trip.participants.find((p) => p.id === participantId);
  if (!participant) throw new Error('Pick who you are first.');
  const mine: TripReply['votes'] = {};
  for (const [slotId, slot] of Object.entries(votes)) {
    for (const [cardId, cardVotes] of Object.entries(slot)) {
      const value = cardVotes[participantId];
      if (value) (mine[slotId] ??= {})[cardId] = value;
    }
  }
  return { tripId: trip.id, participant, votes: mine };
}

export async function replyLink(origin: string, reply: TripReply): Promise<string> {
  return `${origin}/trips/join#r=${await packPayload({ v: 1, ...reply })}`;
}

export async function readReplyLink(packed: string): Promise<TripReply> {
  const raw = obj(await unpackPayload(packed));
  const tripId = id(raw?.tripId);
  const participant = cleanParticipant(raw?.participant, 0);
  if (!raw || raw.v !== 1 || !tripId || !participant) throw new Error('That picks link is damaged.');
  const votes: TripReply['votes'] = {};
  for (const [slotId, slotRaw] of Object.entries(obj(raw.votes) ?? {}).slice(0, 200)) {
    if (!ID.test(slotId)) continue;
    for (const [cardId, value] of Object.entries(obj(slotRaw) ?? {}).slice(0, 40)) {
      if (ID.test(cardId) && (value === 1 || value === -1)) (votes[slotId] ??= {})[cardId] = value;
    }
  }
  return { tripId, participant, votes };
}

/**
 * Merges a friend's picks into the organizer's trip. Their previous votes are
 * replaced wholesale; a vote follows its card if the organizer moved it; a new
 * traveler is added to the trip (up to the party limit).
 */
export function mergeReply(trip: Itinerary, votes: TripVotes, reply: TripReply): { trip: Itinerary; votes: TripVotes; added: boolean } {
  if (reply.tripId !== trip.id) throw new Error('Those picks are for a different trip.');
  const known = trip.participants.some((p) => p.id === reply.participant.id);
  if (!known && trip.participants.length >= MAX_PARTICIPANTS) throw new Error(`Trips can have up to ${MAX_PARTICIPANTS} travelers.`);
  const nextTrip = known ? trip : { ...trip, participants: [...trip.participants, reply.participant] };
  const whoId = reply.participant.id;
  const next: TripVotes = {};
  for (const [slotId, slot] of Object.entries(votes)) {
    for (const [cardId, cardVotes] of Object.entries(slot)) {
      const rest = { ...cardVotes };
      delete rest[whoId];
      (next[slotId] ??= {})[cardId] = rest;
    }
  }
  const slotOf = new Map<string, string>();
  for (const day of trip.days) for (const slot of day.slots) for (const cardId of slot.cardIds) slotOf.set(`${slot.id}|${cardId}`, slot.id);
  // Ideas repeat across days, so a moved card is looked for on its original day first.
  const allSlots = trip.days.flatMap((d) => d.slots);
  const whereIs = (cardId: string, fromSlot: string) => {
    const day = fromSlot.match(/^d\d+-/)?.[0];
    const holders = allSlots.filter((s) => s.cardIds.includes(cardId));
    return (holders.find((s) => day && s.id.startsWith(day)) ?? holders[0])?.id;
  };
  for (const [slotId, slot] of Object.entries(reply.votes)) {
    for (const [cardId, value] of Object.entries(slot)) {
      const target = slotOf.get(`${slotId}|${cardId}`) ?? whereIs(cardId, slotId);
      if (!target) continue;
      ((next[target] ??= {})[cardId] ??= {})[whoId] = value;
    }
  }
  return { trip: nextTrip, votes: next, added: !known };
}
