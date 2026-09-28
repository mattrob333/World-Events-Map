'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Bookmark, BookmarkCheck, Check, Copy, ExternalLink, Globe2, Hotel, MapPin, Plane, Plus, Share2, Sparkles, Ticket, X, CloudSun, BookOpen, WifiOff,
} from 'lucide-react';
import { CATEGORY_META, type Activity } from '@/lib/activity/activities';
import { bookIt, moreInfo, seeIt } from '@/lib/activity/links';
import { formatEventRange, isInSeason, parseDay, TONE_COLOR, verdict } from '@/lib/activity/season';
import { useActivityStore, type SheetSnap } from '@/lib/activity/store';
import { inTrip, pinActivity, unpinActivity } from '@/lib/activity/trip';
import { useDesignerStore } from '@/lib/designer/store';
import { useIntentStore } from '@/lib/intent/store';
import { CATEGORY_ICON } from './icons';
import { glyphColor } from './markerTextures';
import { SeasonStrip } from './SeasonStrip';
import { useConditions, useHomeAirport, type ConditionsState, type Units } from './useActivityData';
import styles from './spot.module.css';

const TAG_LABEL: Record<string, string> = { family: 'Family', solo: 'Solo', nightlife: 'Nightlife', luxury: 'Luxury', budget: 'Budget', adrenaline: 'Adrenaline' };

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return desktop;
}

function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.round((now - Date.parse(iso)) / 60000);
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/^en\./, '');
  } catch {
    return url;
  }
};

/** The desktop side panel's width and its gap from the window edge. */
export const PANEL_WIDTH = 420;
export const PANEL_GAP = 16;

/** The phone tab bar's height, when it shows. The sheet sits on top of it. */
export function tabBarHeight() {
  const nav = document.querySelector<HTMLElement>('nav[aria-label="Mobile primary"]');
  return nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().height : 0;
}

/**
 * Heights on a phone, above the tab bar: peek shows the header, verdict and
 * season; half adds the live module; full reaches up to the app header.
 */
export function snapHeights() {
  const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 56;
  const room = window.innerHeight - tabBarHeight() - Math.max(0, headerBottom) - 8;
  return { peek: Math.min(214, room), half: Math.min(Math.max(420, room * 0.62), room), full: room };
}

/**
 * The card for a spot: what it is, whether now is a good time (and why, in
 * plain words), and everything needed to act on it: see it, book it, find out
 * more, save it, or put it in a trip. A bottom sheet on phones (opens at peek
 * height) and a side panel on desktops. Only one card is ever open.
 */
export function ActivityCard({ activities, units = 'imperial', now: nowProp }: { activities: readonly Activity[]; units?: Units; now?: Date }) {
  const selectedId = useActivityStore((s) => s.selectedId);
  const month = useActivityStore((s) => s.month);
  const { closeCard, setMonth, requestSelect, setSnap: publishSnap } = useActivityStore.getState();
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const map = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);
  const a = selectedId ? map.get(selectedId) ?? null : null;
  const desktop = useIsDesktop();
  const [snap, setSnap] = useState<Exclude<SheetSnap, 'panel'>>('peek');
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cond = useConditions(a, units);
  const homeAirport = useHomeAirport();

  const intents = useIntentStore((s) => s.items);
  const toggleIntent = useIntentStore((s) => s.toggle);
  const trip = useDesignerStore((s) => s.trip);
  const editTrip = useDesignerStore((s) => s.editTrip);

  // A new card opens at peek, focused, with nothing "shared" yet.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (!a && openedFor !== null) setOpenedFor(null);
  if (a && openedFor !== a.id) {
    setOpenedFor(a.id);
    setSnap('peek');
    setShared(false);
    setCopied(null);
  }
  const openId = a?.id ?? null;
  useEffect(() => {
    if (openId) titleRef.current?.focus({ preventScroll: true });
  }, [openId]);

  // The camera keeps the spot in the space the card leaves open. Between one
  // spot and the next (a flight in progress) the space stays as it was.
  const pendingId = useActivityStore((s) => s.pendingId);
  useEffect(() => {
    if (openId) publishSnap(desktop ? 'panel' : snap);
    else if (!pendingId) publishSnap(null);
  }, [openId, pendingId, snap, desktop, publishSnap]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) closeCard();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, closeCard]);

  // ── Drag between heights (phone) ──────────────────────────────────────────
  const drag = useRef<{ y: number; t: number; start: number } | null>(null);
  const [dragY, setDragY] = useState<number | null>(null);
  const onDragStart = (e: ReactPointerEvent) => {
    if (desktop) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), start: snapHeights()[snap] };
  };
  const onDragMove = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const h = drag.current.start + (drag.current.y - e.clientY);
    setDragY(Math.max(120, Math.min(snapHeights().full, h)));
  };
  const onDragEnd = (e: ReactPointerEvent) => {
    if (!drag.current) return;
    const dy = drag.current.y - e.clientY;
    const velocity = dy / Math.max(1, performance.now() - drag.current.t);
    const h = drag.current.start + dy;
    drag.current = null;
    setDragY(null);
    const px = snapHeights();
    if (Math.abs(dy) < 6) {
      setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek');
      return;
    }
    if (h < px.peek - 60 && velocity < -0.3) return closeCard();
    if (Math.abs(velocity) > 0.6) {
      const order = ['peek', 'half', 'full'] as const;
      const k = order.indexOf(snap) + (velocity > 0 ? 1 : -1);
      if (k < 0) return closeCard();
      setSnap(order[Math.min(2, k)]);
      return;
    }
    const nearest = (Object.entries(px) as [typeof snap, number][]).sort((x, y) => Math.abs(x[1] - h) - Math.abs(y[1] - h))[0][0];
    setSnap(nearest);
  };

  if (!a) return null;

  const meta = CATEGORY_META[a.category];
  const Icon = CATEGORY_ICON[a.category];
  const live = cond.status === 'ready' ? cond.data : null;
  const v = verdict(a, month, now, live ? { good: live.good } : null);
  const saved = intents.some((item) => item.verb === 'save' && item.kind === 'spot' && item.id === a.id);
  const added = inTrip(trip, a);
  const see = seeIt(a);
  const book = bookIt(a, { homeAirport, month, now });
  const info = moreInfo(a, now, { tz: a.tz });
  const more = activities
    .filter((x) => x.countryCode === a.countryCode && x.id !== a.id && x.source !== 'profile' && isInSeason(x, month, now))
    .sort((x, y) => (y.heat ?? 0) - (x.heat ?? 0))
    .slice(0, 4);
  const monthParam = month === 'now' ? now.getMonth() + 1 : month;
  const planHref = `/trips/new?${new URLSearchParams({ place: a.id, month: String(monthParam) }).toString()}`;

  const toggleSave = () => toggleIntent({ verb: 'save', kind: 'spot', id: a.id, label: `${a.name} · ${a.place}`, href: `/?spot=${encodeURIComponent(a.id)}` });
  const toggleTrip = () => {
    if (!trip) return;
    editTrip(added ? unpinActivity(trip, a) : pinActivity(trip, a));
  };
  const share = async () => {
    const url = `${location.origin}/?spot=${encodeURIComponent(a.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: a.name, text: `${a.name}, ${a.place}`, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
    } catch {
      // They closed the share sheet.
    }
  };
  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(`#${tag}`);
      setCopied(tag);
    } catch {
      // Clipboard blocked: the chip still shows the tag.
    }
  };

  const height = desktop ? undefined : dragY ?? snapHeights()[snap];
  const eventCountdown = a.source === 'profile' && a.eventDates ? countdown(a.eventDates.start, now) : null;

  return (
    <aside
      key={a.id}
      className={styles.card}
      data-snap={desktop ? 'panel' : snap}
      data-dragging={dragY !== null || undefined}
      style={{ ...(height ? { height } : {}), ['--cat' as string]: meta.color }}
      aria-labelledby="activity-card-title"
      role="dialog"
      aria-modal="false"
    >
      <span className={styles.cardGlow} aria-hidden="true" />
      {!desktop ? (
        <div
          className={styles.handle}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          role="button"
          tabIndex={0}
          aria-label={snap === 'full' ? 'Make the card smaller' : 'Show more of the card'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setSnap(snap === 'full' ? 'peek' : snap === 'peek' ? 'half' : 'full');
          }}
        >
          <span />
        </div>
      ) : null}
      <div className={styles.cardScroll} data-scroll={desktop || snap === 'full' || undefined}>
        <header className={styles.head}>
          <span className={styles.headIcon} style={{ background: meta.color, color: glyphColor(meta.color) }} aria-hidden="true">
            <Icon size={20} strokeWidth={2.25} />
          </span>
          <div className={styles.headText}>
            <h2 id="activity-card-title" ref={titleRef} tabIndex={-1}>{a.name}</h2>
            <p>{a.venue ? `${a.venue} · ` : ''}{a.place}, {a.country}</p>
          </div>
          <div className={styles.headActions}>
            <button type="button" className={styles.iconBtn} onClick={toggleSave} aria-pressed={saved} aria-label={saved ? 'Saved to your trips' : 'Save'} data-pop={saved || undefined}>
              {saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
            </button>
            <button type="button" className={styles.iconBtn} onClick={share} aria-label={shared ? 'Link shared' : 'Share'}>
              {shared ? <Check size={20} /> : <Share2 size={20} />}
            </button>
            <button type="button" className={styles.iconBtn} onClick={closeCard} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </header>

        {a.reason ? (
          <p className={styles.reason}>
            <Sparkles size={14} aria-hidden="true" /> Because you follow {a.reason.name}
            {eventCountdown ? <span className={styles.reasonWhen}> · {eventCountdown}</span> : null}
          </p>
        ) : null}

        <p className={styles.verdict} style={{ color: TONE_COLOR[v.tone] }} data-tone={v.tone} aria-live="polite">
          <span className={styles.verdictDot} style={{ background: TONE_COLOR[v.tone] }} aria-hidden="true" />
          {v.text}
        </p>

        {a.source !== 'profile' ? <SeasonStrip activity={a} month={month} now={now} onPick={(m) => setMonth(m)} /> : null}

        <Live state={cond} a={a} now={now} />

        <section className={styles.section} style={{ ['--d' as string]: 1 }}>
          <h3>Why go</h3>
          <p className={styles.summary}>{a.summary}</p>
          {a.note ? <p className={styles.note}>{a.note}</p> : null}
          {a.tags.length ? (
            <ul className={styles.tags}>
              {a.tags.slice(0, 3).map((tag) => <li key={tag}>{TAG_LABEL[tag] ?? tag}</li>)}
            </ul>
          ) : null}
        </section>

        {see.instagram || see.tiktok || see.youtube ? (
          <section className={styles.section} style={{ ['--d' as string]: 2 }}>
            <h3>See it</h3>
            <div className={styles.seeRow}>
              {see.instagram ? <SocialButton href={see.instagram.url} label="Instagram" official={see.instagram.official} kind="instagram" /> : null}
              {see.tiktok ? <SocialButton href={see.tiktok.url} label="TikTok" official={see.tiktok.official} kind="tiktok" /> : null}
              {see.youtube ? <SocialButton href={see.youtube.url} label="YouTube" official={see.youtube.official} kind="youtube" /> : null}
            </div>
          </section>
        ) : null}

        {book.flights || book.stay || book.tickets || book.bookAheadNote || book.airports ? (
          <section className={styles.section} style={{ ['--d' as string]: 3 }}>
            <h3>Book it</h3>
            <ul className={styles.linkList}>
              {book.flights ? (
                <li><OutLink href={book.flights} icon={<Plane size={18} />} title="Flights" sub={flightLabel(homeAirport, a, book.dates)} /></li>
              ) : null}
              {book.stay ? (
                <li><OutLink href={book.stay} icon={<Hotel size={18} />} title="Places to stay" sub={book.dates ? `${a.place}, ${shortRange(book.dates)}` : a.place} /></li>
              ) : null}
              {book.tickets ? (
                <li><OutLink href={book.tickets} icon={<Ticket size={18} />} title={ticketTitle(a)} sub={hostOf(book.tickets)} /></li>
              ) : null}
            </ul>
            {book.bookAheadNote ? <p className={styles.bookAhead}>{book.bookAheadNote}</p> : null}
            {book.airports ? <p className={styles.airports}><Plane size={13} aria-hidden="true" /> Nearest airports: {book.airports}</p> : null}
          </section>
        ) : null}

        <section className={styles.section} style={{ ['--d' as string]: 4 }}>
          <h3>More info</h3>
          <ul className={styles.linkList}>
            {info.officialSite ? <li><OutLink href={info.officialSite} icon={<Globe2 size={18} />} title="Official site" sub={hostOf(info.officialSite)} /></li> : null}
            {info.directions ? <li><OutLink href={info.directions} icon={<MapPin size={18} />} title="Directions" sub="Google Maps" /></li> : null}
            {info.weather ? <li><OutLink href={info.weather} icon={<CloudSun size={18} />} title="Weather forecast" sub={info.localTime ? `It's ${info.localTime} there now` : hostOf(info.weather)} /></li> : null}
            {info.wikipedia ? <li><OutLink href={info.wikipedia} icon={<BookOpen size={18} />} title="Wikipedia" sub="Background and history" /></li> : null}
          </ul>
          {info.hashtags?.length ? (
            <ul className={styles.hashtags} aria-label="Hashtags, tap to copy">
              {info.hashtags.map((tag) => (
                <li key={tag}>
                  <button type="button" onClick={() => void copyTag(tag)} aria-label={`Copy #${tag}`}>
                    #{tag} {copied === tag ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {more.length ? (
          <section className={styles.section} style={{ ['--d' as string]: 5 }}>
            <h3>More in {a.country}</h3>
            <ul className={styles.more}>
              {more.map((x) => {
                const XI = CATEGORY_ICON[x.category];
                const color = CATEGORY_META[x.category].color;
                return (
                  <li key={x.id}>
                    <button type="button" onClick={() => requestSelect(x.id)}>
                      <span className={styles.moreIcon} style={{ background: color, color: glyphColor(color) }} aria-hidden="true"><XI size={16} strokeWidth={2.25} /></span>
                      <span className={styles.moreText}>
                        <span className={styles.moreName}>{x.name}</span>
                        <span className={styles.moreSub}>{verdict(x, month, now).text}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className={styles.actions}>
          <Link className={styles.primary} href={planHref}>Plan a trip here</Link>
          {trip ? (
            <button type="button" className={styles.secondary} onClick={toggleTrip} aria-pressed={added}>
              {added ? <Check size={18} /> : <Plus size={18} />}
              {added ? 'In your trip' : 'Add to trip'}
            </button>
          ) : (
            <Link className={styles.secondary} href={planHref}><Plus size={18} /> Add to a new trip</Link>
          )}
        </div>
        {a.sources.length ? (
          <p className={styles.sources}>
            Listing from{' '}
            {a.sources.slice(0, 3).map((source, i) => (
              <span key={source}>{i > 0 ? ', ' : ''}<a href={source} target="_blank" rel="noopener noreferrer">{hostOf(source)}</a></span>
            ))}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function countdown(startIso: string, now: Date): string {
  const start = parseDay(startIso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((start.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return 'on now';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 14) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

function OutLink({ href, icon, title, sub }: { href: string; icon: ReactNode; title: string; sub?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <span aria-hidden="true" className={styles.outIcon}>{icon}</span>
      <span><strong>{title}</strong>{sub ? <small>{sub}</small> : null}</span>
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}

const shortDay = (iso: string) => parseDay(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const shortRange = (d: { start: string; end: string }) => `${shortDay(d.start)} to ${shortDay(d.end)}`;

function flightLabel(home: string | undefined, a: Activity, dates?: { start: string; end: string }) {
  const to = a.nearestAirports?.[0]?.iata ?? a.place;
  const route = home ? `${home} to ${to}` : `To ${to}`;
  return dates ? `${route}, ${shortRange(dates)}` : route;
}

function ticketTitle(a: Activity) {
  if (a.category === 'ski') return 'Lift passes';
  if (a.eventDates) return 'Tickets';
  if (a.bookAheadNote && /permit/i.test(a.bookAheadNote)) return 'Permits';
  return 'Tickets and passes';
}

function SocialButton({ href, label, official, kind }: { href: string; label: string; official: boolean; kind: 'instagram' | 'tiktok' | 'youtube' }) {
  return (
    <a className={styles.social} data-kind={kind} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label}${official ? ', official account' : ''} (opens in a new tab)`}>
      <SocialGlyph kind={kind} />
      <span>{label}</span>
    </a>
  );
}

/** Brand marks drawn simply (no brand icon package), sized to the 44px buttons. */
function SocialGlyph({ kind }: { kind: 'instagram' | 'tiktok' | 'youtube' }) {
  if (kind === 'instagram') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === 'tiktok') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M16.6 3c.4 2.1 1.8 3.6 3.9 3.9v3a7 7 0 0 1-3.9-1.2v6.4A5.9 5.9 0 1 1 10.7 9.2v3.1a2.9 2.9 0 1 0 2.9 2.9V3h3z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.9 4.8 12 4.8 12 4.8s-5.9 0-7.6.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8zM10 15.2V8.8l5.2 3.2z" />
    </svg>
  );
}

function Live({ state, a, now }: { state: ConditionsState; a: Activity; now: Date }) {
  // Profile events are listings: the countdown, venue and tickets are the live module.
  if (a.source === 'profile' && a.eventDates) {
    return (
      <section className={`${styles.section} ${styles.live}`} style={{ ['--d' as string]: 0 }}>
        <h3>The date <span className={styles.basis}>Listed</span></h3>
        <div className={styles.stats} data-n={a.ticketUrl ? 3 : 2}>
          <div className={styles.stat}><span className={styles.statLabel}>When</span><span className={styles.statValue}>{formatEventRange(a.eventDates.start, a.eventDates.end)}</span></div>
          <div className={styles.stat}><span className={styles.statLabel}>Starts</span><span className={styles.statValue}>{countdown(a.eventDates.start, now)}</span></div>
          {a.ticketUrl ? <div className={styles.stat}><span className={styles.statLabel}>Tickets</span><a className={`${styles.statValue} ${styles.statLink}`} href={a.ticketUrl} target="_blank" rel="noopener noreferrer">Get tickets</a></div> : null}
        </div>
      </section>
    );
  }
  const title = a.conditions === 'event' ? 'The event' : 'Right now';
  if (state.status === 'loading') {
    return (
      <section className={`${styles.section} ${styles.live}`} aria-busy="true" aria-label="Loading live conditions">
        <h3>{title}</h3>
        <div className={styles.stats}>{[0, 1, 2].map((i) => <div key={i} className={`${styles.stat} ${styles.skeleton}`} />)}</div>
      </section>
    );
  }
  if (state.status === 'offline') {
    return (
      <section className={`${styles.section} ${styles.live}`}>
        <h3>{title}</h3>
        <p className={styles.offline}><WifiOff size={16} aria-hidden="true" /> You are offline. Conditions load when you reconnect.</p>
      </section>
    );
  }
  if (state.status !== 'ready') return null;
  const d = state.data;
  return (
    <section className={`${styles.section} ${styles.live}`} style={{ ['--d' as string]: 0 }}>
      <h3>{title} <span className={styles.basis}>{d.basis}</span></h3>
      {d.stats.length ? (
        <div className={styles.stats} data-n={d.stats.length}>
          {d.stats.slice(0, 3).map((s) => (
            <div key={s.label} className={styles.stat}>
              <span className={styles.statLabel}>{s.label}</span>
              {s.href ? (
                <a className={`${styles.statValue} ${styles.statLink}`} href={s.href} target="_blank" rel="noopener noreferrer">{s.value}</a>
              ) : (
                <span className={styles.statValue}>{s.value}{s.unit ? <small>{s.unit}</small> : null}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {d.explain ? <p className={styles.explain}>{d.explain}</p> : null}
      {d.note ? <p className={styles.note}>{d.note}</p> : null}
      <p className={styles.meta}>
        {d.sources.map((s, i) => <span key={s.url}>{i > 0 ? ' and ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a></span>)}
        {' · '}
        {d.basis === 'Listed' ? 'from the organizer listing' : `updated ${timeAgo(d.updatedAt)}`}
      </p>
    </section>
  );
}
