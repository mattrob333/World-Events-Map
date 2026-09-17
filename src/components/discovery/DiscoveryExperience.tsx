'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobeStage } from '@/components/globe';
import { EventDossier, HoverReadout } from '@/components/panels';
import { SocialLive } from '@/components/social';
import { GlobeControls } from '@/components/chrome';
import { Timeline } from '@/components/timeline';
import { useBeacons, useScoredEvents, type ScoredEvent } from '@/lib/selectors';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { addDays, useTimelineStore } from '@/lib/stores/useTimelineStore';
import { useChromeStore } from '@/lib/stores/useChromeStore';
import { useFilterStore } from '@/lib/stores/useFilterStore';
import { isDemoMode } from '@/lib/flags';
import { useLiveCalendar, useLiveCalendarSync } from '@/lib/data/live-store';
import styles from './discovery.module.css';
import { LivePulse } from '@/components/panels/LivePulse';
import { isHappeningToday } from '@/lib/data/scene-time';

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export function DiscoveryExperience() {
  const searchParams = useSearchParams();
  const linkedEventId = searchParams.get('event');
  useLiveCalendarSync();
  const signalStatus = useLiveCalendar((s) => s.status);
  const enrichedAt = useLiveCalendar((s) => s.enrichedAt);
  const events = useScoredEvents();
  const beacons = useBeacons();
  const focus = useTimelineStore((s) => s.focus);
  const rangeStart = useTimelineStore((s) => s.rangeStart);
  const rangeEnd = useTimelineStore((s) => s.rangeEnd);
  const setFocus = useTimelineStore((s) => s.setFocus);
  const reset = useTimelineStore((s) => s.reset);
  const span = useTimelineStore((s) => s.spanDays);
  const query = useFilterStore((s) => s.query);
  const setQuery = useFilterStore((s) => s.setQuery);
  const select = useGlobeStore((s) => s.select);
  const flyTo = useGlobeStore((s) => s.flyTo);
  const selected = useGlobeStore((s) => s.selectedEventId);
  const [planning, setPlanning] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const openedLink = useRef<string | null>(null);
  const introduced = useRef(false);
  const calendar = useLiveCalendar((s) => s.events);
  useEffect(() => {
    const tick = () => setClock(Date.now());
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);
  const planMode = planning || focus !== rangeStart;
  const scenes = useMemo(
    () =>
      events.filter((event) =>
        planMode
          ? event.start <= addDays(focus, span) &&
            event.end >= addDays(focus, -span)
          : isHappeningToday(event, new Date(clock ?? `${focus}T12:00:00Z`)),
      ),
    [events, planMode, focus, span, clock],
  );
  const upcoming = useMemo(
    () => events.filter((event) => event.start > focus).slice(0, 4),
    [events, focus],
  );
  const spotlight = scenes[0];
  const destinations = new Set(
    scenes.map((event) => `${event.city},${event.country}`),
  ).size;
  const visibleIds = useMemo(
    () => new Set(scenes.map((event) => event.id)),
    [scenes],
  );
  const visibleBeacons = beacons
    .filter((beacon) => visibleIds.has(beacon.eventId))
    .map((beacon) => ({
      ...beacon,
      focused:
        beacon.focused || (!selected && beacon.eventId === spotlight?.id),
    }));
  useEffect(() => {
    if (introduced.current || linkedEventId || !spotlight) return;
    introduced.current = true;
    flyTo(spotlight.coords);
  }, [spotlight, flyTo, linkedEventId]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [select]);

  useEffect(() => {
    if (!linkedEventId) {
      openedLink.current = null;
      return;
    }
    if (openedLink.current === linkedEventId) return;
    const event = calendar.find((entry) => entry.id === linkedEventId);
    if (!event) return;
    openedLink.current = linkedEventId;
    // Saved occasions open in the correct part of the calendar. The store
    // clamps dates beyond the planning horizon and leaves past events readable.
    if (event.start > rangeStart) setFocus(event.start);
    else if (event.end >= rangeStart) reset();
    select(event.id);
    flyTo(event.coords);
  }, [linkedEventId, calendar, rangeStart, setFocus, reset, select, flyTo]);

  const explore = (event: ScoredEvent) => {
    select(event.id);
    flyTo(event.coords);
  };
  const beginPlanning = () => {
    setPlanning(true);
    useChromeStore.getState().setTimelineCollapsed(false);
  };
  const now = () => {
    setPlanning(false);
    reset();
  };

  return (
    <main className={styles.page} style={{ ['--chrome-h' as string]: '5rem' }}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          MERIDIAN<span>THE WORLD, WELL LIVED.</span>
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <button className={!planMode ? styles.active : ''} onClick={now}>
            The world now
          </button>
          <button
            className={planMode ? styles.active : ''}
            onClick={beginPlanning}
          >
            Plan a trip
          </button>
          <Link href="/community">Find your people</Link>
        </nav>
        <div className={styles.account}>
          <Link href="/partners">For partners ↗</Link>
          <Link href="/account" className={styles.signIn}>
            Your account ↗
          </Link>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.status}>
          <i />
          {planMode ? 'YOUR NEXT CHAPTER' : 'THE WORLD IS CALLING'}
          <span>
            {signalStatus === 'enriched'
              ? 'Updated signals'
              : signalStatus === 'offline'
                ? 'Curated calendar · offline'
                : 'Curated calendar'}{' '}
            · {dateLabel(focus)}
          </span>
        </div>
        <label className={styles.search}>
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search events, cities or interests"
            placeholder="A place, a passion, a possibility…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search">
              ×
            </button>
          )}
        </label>
        <button
          className={styles.dateButton}
          onClick={planMode ? now : beginPlanning}
        >
          {planMode ? '← Back to today' : 'Choose your dates ↗'}
        </button>
      </div>

      {planMode && (
        <section
          className={styles.timeline}
          aria-label="Plan your travel dates"
        >
          <div className={styles.planHeading}>
            <span>Find your moment.</span>
            <label>
              Travel date{' '}
              <input
                type="date"
                min={rangeStart}
                max={rangeEnd}
                value={focus}
                onChange={(event) => {
                  if (event.target.value) setFocus(event.target.value);
                }}
              />
            </label>
            <small>
              Selected date ±{span} days · curated demand, not a live forecast
            </small>
          </div>
          <Timeline />
        </section>
      )}

      <section className={styles.world} aria-label="World discovery">
        <div className={styles.globe}>
          <GlobeStage beacons={visibleBeacons} />
        </div>
        <div className={styles.worldHeading}>
          <span className={styles.eyebrow}>
            {planMode
              ? 'MAKE ROOM FOR SOMETHING EXTRAORDINARY'
              : 'GOOD COMPANY. GREAT PLACES.'}
          </span>
          <h1>
            {planMode ? (
              <>
                Your next
                <br />
                <em>great escape.</em>
              </>
            ) : (
              <>
                Somewhere,
                <br />
                <em>it’s happening.</em>
              </>
            )}
          </h1>
          <p>
            {planMode
              ? 'Follow the season. Find your scene. Make it a trip.'
              : 'Discover the places, occasions and people worth going for.'}
          </p>
        </div>

        <div className={styles.spotlight}>
          <div
            className={styles.spotlightImage}
            role="img"
            aria-label="Ocean waves, an atmospheric travel photograph"
          >
            <a
              href="https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1000&q=80"
              target="_blank"
              rel="noreferrer"
            >
              Ocean mood · Unsplash ↗
            </a>
          </div>
          <div className={styles.eyebrow}>
            <span className={styles.spark}>✦</span>{' '}
            {planMode ? 'IN YOUR TRAVEL WINDOW' : 'TODAY’S SPOTLIGHT'}
          </div>
          {spotlight ? (
            <>
              <div className={styles.place}>
                {spotlight.city}
                <span>
                  {spotlight.country} / {spotlight.category}
                </span>
              </div>
              <h2>{spotlight.name}</h2>
              <p>{spotlight.tagline}</p>
              <div className={styles.sceneDates}>
                {dateLabel(spotlight.start)} — {dateLabel(spotlight.end)}
                <span>{planMode ? 'In season' : 'On the calendar today'}</span>
              </div>
              <button
                className={styles.primary}
                onClick={() => explore(spotlight)}
              >
                Explore the scene <span>↗</span>
              </button>
              <Link
                className={styles.textLink}
                href={`/community?event=${spotlight.id}`}
              >
                Find your people here →
              </Link>
            </>
          ) : (
            <>
              <h2>No scenes in this view.</h2>
              <p>
                {query
                  ? 'Try another city or interest, or clear your search.'
                  : 'Great trips start a little ahead. Explore the calendar to find your next moment.'}
              </p>
              <button
                className={styles.primary}
                onClick={query ? () => setQuery('') : beginPlanning}
              >
                {query ? 'Clear search' : 'Explore future dates'} <span>↗</span>
              </button>
            </>
          )}
          <small className={styles.disclosure}>
            {signalStatus === 'enriched' && enrichedAt
              ? `Some signals updated ${new Date(enrichedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Rankings remain modeled, not a live attendance count.`
              : 'Editorial spotlight from curated event data. Popularity is modeled, not measured live.'}
          </small>
        </div>

        <aside className={styles.pulse} aria-label="The world pulse">
          <div className={styles.pulseHeading}>
            <div>
              <span className={styles.eyebrow}>THE PULSE</span>
              <h2>{planMode ? 'On your horizon' : 'Around the world'}</h2>
            </div>
            <span className={styles.curated}>CURATED</span>
          </div>
          <p className={styles.pulseIntro}>
            {planMode
              ? 'Standout occasions around your chosen dates.'
              : 'A few places to have on your radar today.'}
          </p>
          {scenes.slice(0, 4).map((event, index) => (
            <button
              key={event.id}
              className={styles.pulseItem}
              onClick={() => explore(event)}
            >
              <span className={styles.number}>0{index + 1}</span>
              <span>
                <strong>{event.city}</strong>
                <span>{event.name}</span>
                <small>
                  {event.category} · {dateLabel(event.start)}
                </small>
              </span>
              <span className={styles.arrow}>↗</span>
            </button>
          ))}
          {scenes.length === 0 && (
            <p className={styles.noResults}>
              No matching events. Change your dates or search to explore more of
              the calendar.
            </p>
          )}
          <LivePulse
            key={`${spotlight?.id}:${planMode}`}
            eventId={spotlight?.id}
            planning={planMode}
          />
        </aside>

        <div className={styles.worldStats}>
          <div>
            <strong>{scenes.length}</strong>
            <span>{planMode ? 'events in window' : 'events on today'}</span>
          </div>
          <div>
            <strong>{destinations}</strong>
            <span>destinations</span>
          </div>
          <div>
            <strong>{events.length}</strong>
            <span>matching occasions</span>
          </div>
        </div>
        <div className={styles.globeHint}>
          DRAG TO EXPLORE <span>·</span> SELECT A BEACON TO GO DEEPER
        </div>
        <div className={styles.globeControls}>
          <GlobeControls />
        </div>
      </section>

      <section className={styles.nextSection}>
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.eyebrow}>A LITTLE FURTHER AHEAD</span>
            <h2>Make your next move.</h2>
          </div>
          <button className={styles.textLink} onClick={beginPlanning}>
            Explore the full calendar ↗
          </button>
        </div>
        <div className={styles.cards}>
          {upcoming.map((event, index) => (
            <button
              className={`${styles.eventCard} ${styles[`card${index}`]}`}
              key={event.id}
              onClick={() => {
                beginPlanning();
                setFocus(event.start);
                explore(event);
              }}
            >
              <div className={styles.cardTop}>
                <span>{event.category}</span>
                <span>{dateLabel(event.start)}</span>
              </div>
              <div className={styles.cardArt} aria-hidden="true">
                {['◒', '✳', '◈', '◠'][index]}
              </div>
              <div className={styles.cardBottom}>
                <span>
                  {event.city}, {event.country}
                </span>
                <h3>{event.name}</h3>
                <p>{event.tagline}</p>
                <span className={styles.cardAction}>
                  Discover the occasion ↗
                </span>
              </div>
            </button>
          ))}
        </div>
        {!upcoming.length && (
          <p className={styles.noResults}>
            No upcoming events match this search. Try a different destination or
            interest.
          </p>
        )}
      </section>

      <section className={styles.clubSection}>
        <div>
          <span className={styles.eyebrow}>
            GOOD TRIPS BECOME GREAT STORIES
          </span>
          <h2>
            Your kind of place.
            <br />
            <em>Your kind of people.</em>
          </h2>
          <p>
            Build your travel profile, discover shared interests and start a
            circle around your next escape.
          </p>
          <Link className={styles.primary} href="/community">
            Find your people <span>↗</span>
          </Link>
        </div>
        <div className={styles.partnerCard}>
          <span className={styles.eyebrow}>FOR THOSE WHO MAKE IT HAPPEN</span>
          <h3>
            Bring something
            <br />
            worth traveling for.
          </h3>
          <p>
            Exceptional stays, private journeys and unforgettable access. Create
            a partner profile and prepare your first offer.
          </p>
          <Link href="/partners" className={styles.textLink}>
            Explore the partner studio ↗
          </Link>
          <small>
            Preview workspace · availability requires provider confirmation
          </small>
        </div>
      </section>

      <section className={styles.directory}>
        <button onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? '−' : '+'} Browse all {scenes.length}{' '}
          {planMode ? 'events in this window' : 'events on the calendar today'}
        </button>
        {showAll && (
          <div className={styles.directoryGrid}>
            {scenes.map((event) => (
              <button key={event.id} onClick={() => explore(event)}>
                <strong>{event.name}</strong>
                <span>
                  {event.city} · {dateLabel(event.start)} ↗
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
      <footer className={styles.footer}>
        <span>
          MERIDIAN <small>THE WORLD, WELL LIVED.</small>
        </span>
        <p>
          Curated event calendar. Dates and access require confirmation with
          organizers.
          {isDemoMode() && ' Member activity is simulated for this preview.'}
        </p>
        <Link href="/partners">Partner with us ↗</Link>
      </footer>
      {selected && <EventDossier />}
      <HoverReadout />
      <SocialLive />
    </main>
  );
}
