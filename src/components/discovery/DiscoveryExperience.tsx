'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GlobeStage } from '@/components/globe';
import { EventDossier, HoverReadout } from '@/components/panels';
import { SocialLive } from '@/components/social';
import { GlobeControls } from '@/components/chrome';
import { Timeline } from '@/components/timeline';
import { useBeacons, useScoredEvents } from '@/lib/selectors';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import { addDays, useTimelineStore } from '@/lib/stores/useTimelineStore';
import { useChromeStore } from '@/lib/stores/useChromeStore';
import { useFilterStore } from '@/lib/stores/useFilterStore';
import { isDemoMode } from '@/lib/flags';
import { useLiveCalendar, useLiveCalendarSync } from '@/lib/data/live-store';
import styles from './discovery.module.css';
import { LivePulse } from '@/components/panels/LivePulse';
import { isHappeningToday } from '@/lib/data/scene-time';
import { greatCircleDistanceKm } from '@/lib/geo/projection';
import { useViewerLocation } from '@/lib/location/useViewerLocation';
import { EVENTS } from '@/lib/data/events';
import { indexDestinations } from '@/lib/pulse';
import { track } from '@/lib/analytics';

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
  const calendar = useLiveCalendar((s) => s.events);
  const viewer = useViewerLocation();
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
  const nearbyScenes = useMemo(() => {
    const coords = viewer.coords;
    if (!coords) return [];
    return scenes
      .map((event) => ({
        event,
        distanceKm: greatCircleDistanceKm(coords, event.coords),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [scenes, viewer.coords]);

  const worldHeat = useMemo(
    () => [...scenes].sort((a, b) => a.buzz.rank - b.buzz.rank),
    [scenes],
  );

  const pulseScenes = planMode ? scenes : worldHeat;
  const destinationsIndex = useMemo(() => indexDestinations(EVENTS), []);
  const destinationHref = (eventId: string) => {
    const destination = destinationsIndex.byEventId.get(eventId);
    return destination ? `/destinations/${destination.slug}` : `/?event=${eventId}`;
  };
  useEffect(() => {
    track('world_opened', { surface: 'pulse' });
  }, []);
  const spotlight = planMode ? scenes[0] : (nearbyScenes[0]?.event ?? worldHeat[0]);
  const spotlightDistance =
    !planMode && nearbyScenes[0]?.event.id === spotlight?.id
      ? nearbyScenes[0].distanceKm
      : null;
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
    if (viewer.status !== 'granted' || !viewer.coords || linkedEventId) return;
    flyTo(viewer.coords, 3.9);
  }, [viewer.status, viewer.coords, linkedEventId, flyTo]);

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
      <div className={styles.toolbar}>
        <div className={styles.status}>
          <i />
          {planMode ? 'YOUR NEXT CHAPTER' : 'YOUR WORLD, RIGHT NOW'}
          <span>
            {signalStatus === 'enriched'
              ? 'Updated signals'
              : signalStatus === 'offline'
                ? 'Curated calendar · offline'
                : 'Curated calendar'}{' '}
            · {dateLabel(focus)} ·{' '}
            {viewer.status === 'granted'
              ? 'Centered near you'
              : viewer.status === 'locating'
                ? 'Locating you'
                : 'Regional view'}
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
          className={styles.locationButton}
          onClick={viewer.retry}
          disabled={viewer.status === 'locating'}
        >
          {viewer.status === 'granted'
            ? 'Recenter near me'
            : viewer.status === 'locating'
              ? 'Finding your position…'
              : 'Use my location'}
        </button>
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
          {viewer.coords ? (
            <GlobeStage
              beacons={visibleBeacons}
              initialView={viewer.launchCoords ?? viewer.coords}
            />
          ) : (
            <div className={styles.globeBoot}>
              <span />
              <strong>Opening your part of the world…</strong>
            </div>
          )}
        </div>
        <div className={styles.worldHeading}>
          <span className={styles.eyebrow}>
            {planMode
              ? 'MAKE ROOM FOR SOMETHING EXTRAORDINARY'
              : 'THE WORLD, SORTED BY ENERGY'}
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
                Your world,
                <br />
                <em>right now.</em>
              </>
            )}
          </h1>
          <p>
            {planMode
              ? 'Follow the season. Find your scene. Make it a trip.'
              : 'Start near you, then scan the places pulling people in from everywhere.'}
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
            {planMode ? 'IN YOUR TRAVEL WINDOW' : 'NEAREST SCENE ON THE BOARD'}
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
                <span>
                  {planMode
                    ? 'In season'
                    : spotlightDistance != null
                      ? `≈${Math.round(spotlightDistance).toLocaleString()} km away · on the calendar today`
                      : 'On the calendar today'}
                </span>
              </div>
              <Link className={styles.primary} href={destinationHref(spotlight.id)}>
                Open {spotlight.city} <span>↗</span>
              </Link>
              <Link
                className={styles.textLink}
                href={`/circles?destination=${destinationsIndex.byEventId.get(spotlight.id)?.slug ?? ''}`}
              >
                Start a Circle here →
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
              <span className={styles.eyebrow}>{planMode ? 'THE PULSE' : 'WORLD HEAT'}</span>
              <h2>{planMode ? 'On your horizon' : 'Where the FOMO is building'}</h2>
            </div>
            <span className={styles.curated}>{signalStatus === 'enriched' ? 'UPDATED SIGNALS' : 'MODELED'}</span>
          </div>
          <p className={styles.pulseIntro}>
            {planMode
              ? 'Standout occasions around your chosen dates.'
              : 'The strongest current travel-demand signals, regardless of distance.'}
          </p>
          {pulseScenes.slice(0, 4).map((event, index) => (
            <Link
              key={event.id}
              className={styles.pulseItem}
              href={destinationHref(event.id)}
            >
              <span className={styles.number}>0{index + 1}</span>
              <span>
                <strong>{event.city}</strong>
                <span>{event.name}</span>
                <small>
                  {planMode
                    ? `${event.category} · ${dateLabel(event.start)}`
                    : `${event.buzz.heat} · heat ${Math.round(event.buzz.score)}/100`}
                </small>
              </span>
              <span className={styles.arrow}>↗</span>
            </Link>
          ))}
          {pulseScenes.length === 0 && (
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
          DRAG TO ORBIT <span>·</span> CTRL/CMD + SCROLL OR PINCH TO ZOOM <span>·</span> SCROLL TO MOVE DOWN THE PAGE
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
            <Link
              className={`${styles.eventCard} ${styles[`card${index}`]}`}
              key={event.id}
              href={destinationHref(event.id)}
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
                  Open {event.city} ↗
                </span>
              </div>
            </Link>
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
              <Link key={event.id} href={destinationHref(event.id)}>
                <strong>{event.name}</strong>
                <span>
                  {event.city} · {dateLabel(event.start)} ↗
                </span>
              </Link>
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
