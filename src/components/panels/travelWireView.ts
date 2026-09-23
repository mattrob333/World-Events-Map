/**
 * Presentation helpers for the Live Travel Wire.
 *
 * These functions only rearrange fields the server already sent. They do not
 * decide freshness, invent attendance, or rewrite headlines.
 */

import type { LiveTravelWire, WireCard } from '@/lib/signals/wire';
import { buildTripLink } from '@/lib/social/invite';

export type WireChromeStatus = LiveTravelWire['status'] | 'error' | 'loading';

export interface WireChrome {
  title: string;
  /** Soft banner. Empty and error use EmptyState instead. */
  banner: string | null;
  /** True only while the server says the stream has a fresh reading. */
  live: boolean;
  empty: boolean;
  useEmptyState: boolean;
  emptyTitle: string;
  emptyBody: string | null;
}

export interface WireAsOf {
  /** Short clock, e.g. `14:40Z`. Empty when no source/observed time exists. */
  clock: string | null;
  /** Prefer the source's publication time. Never the wire fetch time. */
  absolute: string | null;
  relative: string | null;
  /** Label for the compact card corner. */
  label: string;
  missing: boolean;
}

/** Locked action words. There is no `src/lib/intent` module on this branch. */
export const WIRE_ACTIONS = [
  { id: 'why', label: 'WHY?', needsAuth: false, needsEntity: false },
  { id: 'save', label: 'Save', needsAuth: true, needsEntity: true },
  { id: 'watch', label: 'Watch', needsAuth: true, needsEntity: true },
  { id: 'id_go', label: "I'd go", needsAuth: true, needsEntity: true },
  { id: 'start_circle', label: 'Start Circle', needsAuth: true, needsEntity: true },
  { id: 'share', label: 'Share', needsAuth: false, needsEntity: true },
] as const;

export type WireActionId = (typeof WIRE_ACTIONS)[number]['id'];

export const WIRE_UNAVAILABLE_NOTE =
  'Travel Wire unavailable. World Pulse still works.';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC clock that does not depend on the browser's locale tables. */
export function formatUtcClock(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}Z`;
}

/** Absolute UTC stamp shown when the card is expanded. */
export function formatUtcAbsolute(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}Z`;
}

/** Display-only relative time. Not used to decide stale vs fresh. */
export function formatUtcRelative(iso: string | undefined, nowIso: string): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  const mins = Math.round((now - then) / 60_000);
  if (Math.abs(mins) < 1) return 'just now';
  if (mins >= 0 && mins < 60) return `${mins}m ago`;
  if (mins < 0 && mins > -60) return `in ${Math.abs(mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours >= 0 && hours < 48) return `${hours}h ago`;
  if (hours < 0 && hours > -48) return `in ${Math.abs(hours)}h`;
  const days = Math.round(hours / 24);
  if (days >= 0) return `${days}d ago`;
  return `in ${Math.abs(days)}d`;
}

export function formatWireNumber(value: number | undefined): string | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  return String(Math.round(value * 1000) / 1000);
}

export function formatValuePair(value: number | undefined, previous: number | undefined): string | null {
  const current = formatWireNumber(value);
  if (!current) return null;
  const prior = formatWireNumber(previous);
  return prior ? `${current} (was ${prior})` : current;
}

export function cardEntity(card: WireCard): string | null {
  if (card.eventName && card.city) return `${card.eventName} · ${card.city}`;
  if (card.eventName) return card.eventName;
  if (card.city) return card.city;
  return null;
}

/** Badge text comes from the engine. `changed materially` is already Changed. */
export function cardBadge(card: WireCard): string {
  return card.deltaLabel;
}

export function isCardMuted(card: WireCard): boolean {
  return card.delta === 'stale';
}

export function shouldAnimateStream(status: WireChromeStatus): boolean {
  return status === 'observations';
}

export function shouldPulseRising(status: WireChromeStatus, card: WireCard): boolean {
  return shouldAnimateStream(status) && card.delta === 'rising' && !isCardMuted(card);
}

export function cardAsOf(card: WireCard, nowIso: string): WireAsOf {
  const preferred = card.sourcePublishedAt ?? card.observedAt;
  const clock = formatUtcClock(preferred);
  const absolute = formatUtcAbsolute(preferred);
  const relative = formatUtcRelative(preferred, nowIso);
  if (!preferred || !clock) {
    return {
      clock: null,
      absolute: null,
      relative: null,
      label: 'Time unknown',
      missing: true,
    };
  }
  return {
    clock,
    absolute,
    relative,
    label: card.sourcePublishedAt ? `Source pub ${clock}` : `Observed ${clock}`,
    missing: false,
  };
}

export function cardMeta(card: WireCard): string {
  return `${card.sourceFamily} · ${card.label} · ${card.truthStatus}`;
}

export function staleConfirmLine(card: WireCard): string | null {
  if (card.delta !== 'stale') return null;
  const observed = formatUtcClock(card.observedAt);
  const published = formatUtcClock(card.sourcePublishedAt);
  const parts: string[] = [];
  if (observed) parts.push(`Observed ${observed}`);
  if (published) parts.push(`Last confirmed as published ${published}`);
  return parts.length ? parts.join(' · ') : null;
}

export function wireChrome(
  status: WireChromeStatus,
  note: string | null,
  generatedAt: string | null,
  nowIso: string,
): WireChrome {
  if (status === 'loading') {
    return {
      title: 'Live Travel Wire',
      banner: null,
      live: false,
      empty: false,
      useEmptyState: false,
      emptyTitle: 'Live Travel Wire',
      emptyBody: null,
    };
  }
  if (status === 'error') {
    return {
      title: 'Live Travel Wire',
      banner: null,
      live: false,
      empty: true,
      useEmptyState: true,
      emptyTitle: 'Live Travel Wire',
      emptyBody: WIRE_UNAVAILABLE_NOTE,
    };
  }
  if (status === 'empty') {
    return {
      title: 'Live Travel Wire',
      banner: null,
      live: false,
      empty: true,
      useEmptyState: true,
      emptyTitle: 'Live Travel Wire',
      emptyBody: note,
    };
  }
  if (status === 'degraded') {
    return {
      title: 'Live Travel Wire · Stale readings',
      banner: note,
      live: false,
      empty: false,
      useEmptyState: false,
      emptyTitle: 'Live Travel Wire',
      emptyBody: null,
    };
  }
  const updated = generatedAt ? formatUtcRelative(generatedAt, nowIso) : null;
  return {
    title: updated ? `Live Travel Wire · Updated ${updated}` : 'Live Travel Wire',
    banner: note,
    live: true,
    empty: false,
    useEmptyState: false,
    emptyTitle: 'Live Travel Wire',
    emptyBody: null,
  };
}

export interface WhyRow {
  label: string;
  value: string;
}

/** WHY sheet rows — card fields only, no extra prose. */
export function whyRows(card: WireCard): WhyRow[] {
  const value = formatValuePair(card.value, card.previousValue) ?? 'n/a';
  return [
    { label: 'Reading', value: card.label },
    { label: 'Value', value },
    { label: 'Truth', value: card.truthStatus },
    { label: 'Source family', value: card.sourceFamily },
    {
      label: 'Source published',
      value: card.sourcePublishedAt
        ? (formatUtcAbsolute(card.sourcePublishedAt) ?? card.sourcePublishedAt)
        : 'Not provided',
    },
    {
      label: 'Observed',
      value: formatUtcAbsolute(card.observedAt) ?? card.observedAt,
    },
  ];
}

export function actionHref(id: WireActionId, eventId: string | undefined): string | null {
  if (!eventId) return null;
  if (id === 'save' || id === 'watch') {
    return `/account?event=${encodeURIComponent(eventId)}`;
  }
  if (id === 'id_go' || id === 'start_circle') {
    return `/community?event=${encodeURIComponent(eventId)}`;
  }
  if (id === 'share') return buildTripLink(eventId);
  return null;
}

export function eventHref(eventId: string | undefined): string | null {
  if (!eventId) return null;
  return `/?event=${encodeURIComponent(eventId)}`;
}

export function inventedHeatCopy(text: string): boolean {
  const stripped = text.replace(/not attendance/gi, '');
  return /attendance|live crowd|sold out|viral|\$\d/i.test(stripped);
}
