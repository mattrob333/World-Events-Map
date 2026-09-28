import type { Fetcher, Stat } from './types';
import { parseDay } from '../season';

const DAY = 86_400_000;

function httpsUrl(raw: string | undefined): URL | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && u.hostname ? u : null;
  } catch {
    return null;
  }
}

/**
 * Events: countdown, venue, official link. No network: built from the listing in
 * activities.json. "Today" is the server's calendar day, which is close enough for
 * a countdown in days and weeks.
 */
export const fetchEvent: Fetcher = async (a, { now }) => {
  const ev = a.eventDates;
  if (!ev) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const s = parseDay(ev.start), e = parseDay(ev.end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const days = Math.round((s.getTime() - today.getTime()) / DAY);
  const stats: Stat[] = [];
  if (today >= s && today <= e) stats.push({ label: 'Status', value: 'On now' });
  else if (days > 0) {
    const weeks = Math.round(days / 7);
    stats.push(
      days < 14 ? { label: 'Starts in', value: String(days), unit: days === 1 ? 'day' : 'days' }
      : weeks <= 12 ? { label: 'Starts in', value: String(weeks), unit: 'weeks' }
      : { label: 'Starts in', value: String(Math.round(days / 30.4)), unit: 'months' },
    );
  }
  if (a.place) stats.push({ label: 'Venue', value: a.venue || a.place });
  const src = httpsUrl(ev.sourceUrl);
  if (src) stats.push({ label: ev.status === 'confirmed' ? 'Tickets' : 'Details', value: 'Official site', href: src.toString() });
  const note =
    ev.status === 'estimated' ? 'Dates estimated from past editions until the organizer confirms.'
    : ev.status === 'under-review' ? 'The organizer has these dates under review.'
    : undefined;
  return {
    kind: 'event',
    stats,
    good: null,
    basis: 'Listed',
    note,
    sources: src ? [{ name: src.hostname.replace(/^www\./, ''), url: src.toString() }] : [],
    updatedAt: now.toISOString(),
  };
};
