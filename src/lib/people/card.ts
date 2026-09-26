import { profileArtists, type TravelerProfile } from '@/lib/designer/profile';

/**
 * A travel card: the part of a traveler profile worth handing to someone you
 * travel with. Name, home city, what they love, how they like to travel.
 * Deliberately not family names or ages, heritage, or their own words: a card
 * travels as a link and anyone holding the link can read it.
 *
 * The card rides in the link fragment (`/people/card#c=…`), which browsers
 * never send to a server; decoding treats it as untrusted.
 */
export type TravelCard = {
  v: 1;
  name: string;
  hometown?: string;
  loves: string[];
  music: string[];
  teams: string[];
  style: string[];
  bucketList: string[];
  sentAt: string;
};

const MAX_CARD_CHARS = 4000;
const clean = (value: unknown, max = 60) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const list = (value: unknown, count = 8, max = 60) =>
  (Array.isArray(value) ? [...new Set(value.map((item) => clean(item, max)).filter(Boolean))] : []).slice(0, count);

const PACE: Record<string, string> = { slow: 'Slow and savored', balanced: 'Balanced pace', packed: 'Packed days' };
const BUDGET: Record<string, string> = { shoestring: 'Shoestring', comfortable: 'Comfortable', premium: 'Premium', 'no-limit': 'Sky’s the limit' };
const SOCIAL: Record<string, string> = { 'recharge-solo': 'Recharges solo', 'small-crew': 'Small crew', 'meet-everyone': 'Meets everyone' };

export function cardFromProfile(profile: TravelerProfile, fallbackName: string, now = new Date()): TravelCard {
  const style = profile.style;
  return {
    v: 1,
    name: clean(profile.name, 40) || clean(fallbackName, 40) || 'A traveler',
    ...(profile.hometown ? { hometown: clean(profile.hometown, 60) } : {}),
    loves: list([...profile.interests, ...profile.food, ...profile.events]),
    music: list([...profileArtists(profile), ...profile.music], 8),
    teams: list(profile.teams, 4),
    style: list([style?.pace && PACE[style.pace], style?.budget && BUDGET[style.budget], style?.social && SOCIAL[style.social]].filter(Boolean), 3),
    bucketList: list(style?.bucketList ?? [], 5),
    sentAt: now.toISOString(),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeCard(card: TravelCard): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(card)));
}

export function decodeCard(encoded: string): TravelCard | null {
  if (!encoded || encoded.length > MAX_CARD_CHARS || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (char) => char.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (raw?.v !== 1) return null;
    const name = clean(raw.name, 40);
    if (!name) return null;
    const sent = typeof raw.sentAt === 'string' && Number.isFinite(Date.parse(raw.sentAt)) ? new Date(raw.sentAt).toISOString() : new Date(0).toISOString();
    const hometown = clean(raw.hometown, 60);
    return {
      v: 1, name, ...(hometown ? { hometown } : {}),
      loves: list(raw.loves), music: list(raw.music), teams: list(raw.teams, 4), style: list(raw.style, 3), bucketList: list(raw.bucketList, 5), sentAt: sent,
    };
  } catch {
    return null;
  }
}

export function cardUrl(origin: string, card: TravelCard): string {
  return `${origin.replace(/\/$/, '')}/people/card#c=${encodeCard(card)}`;
}

/** What two travelers share: the first thing to plan around. */
export function commonGround(mine: TravelCard, theirs: TravelCard): string[] {
  const key = (value: string) => value.toLowerCase();
  const pool = (card: TravelCard) => [...card.loves, ...card.music, ...card.teams, ...card.bucketList];
  const theirKeys = new Set(pool(theirs).map(key));
  return [...new Set(pool(mine).filter((value) => theirKeys.has(key(value))))].slice(0, 6);
}
