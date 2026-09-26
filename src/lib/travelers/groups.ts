import { emptyProfile, profileTags, type TravelerProfile } from '@/lib/designer/profile';
import { cardFromProfile, decodeCard, encodeCard, type TravelCard } from '@/lib/people/card';

/**
 * Travelers and groups. Every saved profile is one traveler (you, your
 * partner, each kid), built by talking for a minute. A group is who is
 * coming: Solo is you, Family is you and your household, Friends is whoever
 * you add. Another family joins a group from a link ("add group"), as
 * travel cards: what they love and how they travel, never their own words.
 */
export type GroupKind = 'solo' | 'family' | 'friends' | 'custom';

export type GroupGuest = { id: string; card: TravelCard; addedAt: string };

export type TravelGroup = {
  id: string;
  name: string;
  kind: GroupKind;
  /** Saved profile ids; the first is who leads (whose home city and taste the trip starts from). */
  memberIds: string[];
  /** Travelers from another device, added from a group or card link. */
  guests: GroupGuest[];
  updatedAt: string;
};

type Member = { id: string; profile: TravelerProfile };

export const MAX_GROUPS = 12;
export const MAX_GROUP_MEMBERS = 12;
export const MAX_GUESTS = 12;

const clean = (value: string, max: number) => value.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const same = (a?: string, b?: string) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const DEFAULT_GROUP_NAMES: Record<Exclude<GroupKind, 'custom'>, string> = { solo: 'Solo', family: 'Family', friends: 'Friends' };

export function createGroup(name: string, kind: GroupKind, memberIds: string[] = [], now = new Date()): TravelGroup {
  return { id: newId('grp'), name: clean(name, 30) || 'New group', kind, memberIds: [...new Set(memberIds)].slice(0, MAX_GROUP_MEMBERS), guests: [], updatedAt: now.toISOString() };
}

/**
 * Solo, Family and Friends always exist, each led by you. Groups you made
 * stay as they are; members whose profile is gone drop out.
 */
export function ensureDefaultGroups(groups: TravelGroup[], meId: string | null, profileIds: string[], now = new Date()): TravelGroup[] {
  const known = new Set(profileIds);
  const tidy = groups.map((group) => {
    const memberIds = group.memberIds.filter((id) => known.has(id));
    const withMe = meId && known.has(meId) && group.kind !== 'custom' && !memberIds.includes(meId) ? [meId, ...memberIds] : memberIds;
    return withMe.length === group.memberIds.length && withMe.every((id, i) => id === group.memberIds[i]) ? group : { ...group, memberIds: withMe.slice(0, MAX_GROUP_MEMBERS) };
  });
  const out = [...tidy];
  for (const kind of ['solo', 'family', 'friends'] as const) {
    if (out.some((group) => group.kind === kind)) continue;
    // A fixed id, so the same default group on two devices is one group in the account.
    // Stamped as oldest, so a fresh default never overwrites the account's copy of the same group.
    out.push({ ...createGroup(DEFAULT_GROUP_NAMES[kind], kind, meId && known.has(meId) ? [meId] : [], now), id: `grp-${kind}`, updatedAt: new Date(0).toISOString() });
  }
  // Solo is only ever you.
  return out
    .map((group) => (group.kind === 'solo' ? { ...group, memberIds: meId && known.has(meId) ? [meId] : [], guests: [] } : group))
    .slice(0, MAX_GROUPS);
}

export type GroupTraveler = {
  key: string;
  name: string;
  kind: 'adult' | 'kid';
  age?: number;
  tags: string[];
  /** The saved profile this traveler came from; guests have none. */
  board?: string;
};

const isKid = (profile: { age?: number }) => profile.age !== undefined && profile.age < 18;

/** A guest's card as a profile, so their loves reach the planner the way a member's do. */
export function profileFromCard(card: TravelCard): TravelerProfile {
  return { ...emptyProfile(), name: card.name, hometown: card.hometown, interests: card.loves, music: card.music, teams: card.teams, summary: '' };
}

/**
 * Everyone in the group, as the trip designer's traveler list. Each member
 * profile is one person. On a Family group the leader's household roster
 * ("my wife and two boys") fills in anyone who has no profile of their own
 * yet, matched by name so no one appears twice.
 */
export function groupTravelers(group: TravelGroup, profiles: Member[]): GroupTraveler[] {
  const byId = new Map(profiles.map((entry) => [entry.id, entry]));
  const members = group.memberIds.map((id) => byId.get(id)).filter((entry): entry is Member => Boolean(entry));
  const out: GroupTraveler[] = members.map((entry) => {
    const kid = isKid(entry.profile);
    return {
      key: `${entry.id}:self`,
      name: entry.profile.name ?? 'Traveler',
      kind: kid ? 'kid' : 'adult',
      age: entry.profile.age,
      tags: kid ? [] : profileTags(entry.profile).filter((tag) => !tag.endsWith('kids')),
      board: entry.id,
    };
  });
  const lead = members[0];
  if (group.kind === 'family' && lead) {
    lead.profile.family.forEach((member, i) => {
      if (member.name && members.some((entry) => same(entry.profile.name, member.name))) return;
      const kid = member.relation === 'child' || (member.age !== undefined && member.age < 18);
      out.push({
        key: `${lead.id}:m${i}`,
        name: member.name ?? (member.age !== undefined ? `${member.label} (${member.age})` : member.label),
        kind: kid ? 'kid' : 'adult',
        age: member.age,
        tags: [],
        board: lead.id,
      });
    });
  }
  for (const guest of group.guests) {
    // Someone already here with their own profile (same name and home city) isn't added twice.
    if (members.some((entry) => same(entry.profile.name, guest.card.name) && (!guest.card.hometown || same(entry.profile.hometown, guest.card.hometown)))) continue;
    out.push({
      key: `guest:${guest.id}`,
      name: guest.card.name,
      kind: guest.card.kid ? 'kid' : 'adult',
      tags: guest.card.kid ? [] : profileTags(profileFromCard(guest.card)),
    });
  }
  return out;
}

/** Guests added from a link; the same person (name and home city) is refreshed, not doubled. */
export function addGuests(group: TravelGroup, cards: TravelCard[], now = new Date()): TravelGroup {
  const key = (card: TravelCard) => `${card.name.toLowerCase()}|${(card.hometown ?? '').toLowerCase()}`;
  const guests = [...group.guests];
  for (const card of cards) {
    const at = guests.findIndex((guest) => key(guest.card) === key(card));
    if (at >= 0) guests[at] = { ...guests[at], card };
    else guests.push({ id: newId('gst'), card, addedAt: now.toISOString() });
  }
  return { ...group, guests: guests.slice(0, MAX_GUESTS), updatedAt: now.toISOString() };
}

// --- group links ------------------------------------------------------------

/** What an "add group" link carries: the group's name and a travel card per person. */
export type GroupInvite = { v: 1; name: string; cards: TravelCard[]; sentAt: string };

const MAX_INVITE_CHARS = 24000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function inviteFromGroup(group: TravelGroup, profiles: Member[], labels: (entry: Member) => string, now = new Date()): GroupInvite {
  const byId = new Map(profiles.map((entry) => [entry.id, entry]));
  const cards = group.memberIds
    .map((id) => byId.get(id))
    .filter((entry): entry is Member => Boolean(entry))
    .map((entry) => cardFromProfile(entry.profile, labels(entry), now));
  // "Family" means nothing on their phone; "Matt’s family" does.
  const lead = byId.get(group.memberIds[0]);
  const name = group.kind === 'custom' || !lead ? group.name : `${labels(lead)}’s ${group.name.toLowerCase()}`;
  return { v: 1, name: clean(name, 30) || 'Our group', cards: cards.slice(0, MAX_GUESTS), sentAt: now.toISOString() };
}

export function encodeInvite(invite: GroupInvite): string {
  // Each card goes through the card encoder's rules, so a group link never carries more than a card link would.
  const payload = { v: 1, name: invite.name, cards: invite.cards.map(encodeCard), sentAt: invite.sentAt };
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
}

/** Reads an invite from a link fragment. Untrusted: every card is decoded and cleaned on its own. */
export function decodeInvite(encoded: string): GroupInvite | null {
  if (!encoded || encoded.length > MAX_INVITE_CHARS || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (char) => char.charCodeAt(0));
    const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    if (raw?.v !== 1 || !Array.isArray(raw.cards)) return null;
    const cards = raw.cards
      .slice(0, MAX_GUESTS)
      .map((item) => (typeof item === 'string' ? decodeCard(item) : null))
      .filter((card): card is TravelCard => Boolean(card));
    if (!cards.length) return null;
    const sent = typeof raw.sentAt === 'string' && Number.isFinite(Date.parse(raw.sentAt)) ? new Date(raw.sentAt).toISOString() : new Date(0).toISOString();
    return { v: 1, name: clean(typeof raw.name === 'string' ? raw.name : '', 30) || 'Their group', cards, sentAt: sent };
  } catch {
    return null;
  }
}

export function inviteUrl(origin: string, invite: GroupInvite): string {
  return `${origin.replace(/\/$/, '')}/vibe/group#g=${encodeInvite(invite)}`;
}
