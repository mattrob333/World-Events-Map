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
 * Events: countdown, venue, and a link labeled for where it goes. No network: built from the listing in
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
  // Say where a link goes: a ticket page only when the record has one, else the
  // official site, else the page the dates came from (a calendar, an article).
  const tickets = httpsUrl(a.links?.tickets) ?? httpsUrl(a.ticketUrl);
  const official = httpsUrl(a.links?.officialSite);
  const host = (u: URL) => u.hostname.replace(/^www\./, '');
  if (tickets) stats.push({ label: 'Tickets', value: 'Get tickets', href: tickets.toString() });
  else if (official) stats.push({ label: 'Official site', value: host(official), href: official.toString() });
  else if (src) stats.push({ label: 'Dates from', value: host(src), href: src.toString() });
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
