'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useCommandStore } from '@/components/shell/commandStore';
import { useFilterStore } from '@/lib/stores/useFilterStore';
import { isDemoMode } from '@/lib/flags';
import { useLiveCalendar, useLiveCalendarSync } from '@/lib/data/live-store';
import styles from './discovery.module.css';
import { LivingDashboard } from './LivingDashboard';
import { LivePulse } from '@/components/panels/LivePulse';
import { isHappeningToday } from '@/lib/data/scene-time';
import { greatCircleDistanceKm } from '@/lib/geo/projection';
import { googleMapsViewUrl } from '@/lib/geo/map-links';
import { useViewerLocation } from '@/lib/location/useViewerLocation';
import { VIEWER_CITIES } from '@/lib/location/browser-position';
import { OPENING_GLOBE_DISTANCE } from '@/lib/geo/camera';
import { EVENTS } from '@/lib/data/events';
import { indexDestinations } from '@/lib/pulse';
import { track } from '@/lib/analytics';
import type { WorldEvent } from '@/lib/types';
import { WorldIntro } from './WorldIntro';
import { editorialEventForMode, resolveGlobeStory, spotlightNearestDistance } from './globe-story';
import { discoveryQuery, readDiscoveryState, type DiscoveryState } from './journey-url';
import { estimateRoute } from '@/lib/travel/route-estimate';
import { formatDateRange } from '@/components/ui/tokens';
import { selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

const SEASON_LABEL: Record<TripSeason, string> = {
  all: 'Any season', winter: 'Winter', spring: 'Spring', summer: 'Summer', fall: 'Fall',
};
const INTEREST_LABEL: Record<TripInterest, string> = {
  all: 'Anything', ski: 'Ski & snow', coast: 'Coast & water',
  adventure: 'Nature & adventure', culture: 'Culture & food',
};

export function DiscoveryExperience() {
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const syncLocalToday = useTimelineStore((s) => s.syncLocalToday);
  const span = useTimelineStore((s) => s.spanDays);
  const query = useFilterStore((s) => s.query);
  const setQuery = useFilterStore((s) => s.setQuery);
  const select = useGlobeStore((s) => s.select);
  const flyTo = useGlobeStore((s) => s.flyTo);
  const travelTo = useGlobeStore((s) => s.travelTo);
  const selected = useGlobeStore((s) => s.selectedEventId);
  const [planning, setPlanning] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // Season, interest and the chosen journey live in the URL: refresh keeps
  // them and browser Back leaves a journey instead of leaving dope.travel.
  const discovery = readDiscoveryState(searchParams);
  const journeyEventId = discovery.journey;
  const tripMode = useMemo(
    () => ({ season: discovery.season, interest: discovery.interest }),
    [discovery.season, discovery.interest],
  );
  const navigateDiscovery = (next: Partial<DiscoveryState>, mode: 'push' | 'replace' = 'replace') => {
    const href = discoveryQuery(new URLSearchParams(searchParams.toString()), next);
    if (mode === 'push') router.push(href, { scroll: false });
    else router.replace(href, { scroll: false });
  };
  const setJourneyEventId = (journey: string | null) => {
    if (journey === discovery.journey) return;
    navigateDiscovery({ journey });
  };
  const [clock, setClock] = useState<number | null>(null);
  const openedLink = useRef<string | null>(null);
  const routeTimer = useRef<number | null>(null);
  const citySelect = useRef<HTMLSelectElement | null>(null);
  const calendar = useLiveCalendar((s) => s.events);
  const viewer = useViewerLocation();
  useEffect(() => {
    const tick = () => {
      syncLocalToday();
      setClock(Date.now());
    };
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [syncLocalToday]);
  const planMode = planning || focus !== rangeStart;
  const modeActive = !planMode && !query && (tripMode.season !== 'all' || tripMode.interest !== 'all');
  const modeLabel = `${SEASON_LABEL[tripMode.season]} · ${INTEREST_LABEL[tripMode.interest]}`;
  const modeEvents = useMemo(
    () => modeActive ? selectSeasonalEvents(EVENTS, focus, tripMode.season, tripMode.interest) : [],
    [modeActive, focus, tripMode.season, tripMode.interest],
  );
  const modeIds = useMemo(() => new Set(modeEvents.map((event) => event.id)), [modeEvents]);
  const modeEditorial = modeActive
    ? editorialEventForMode(EVENTS, focus, tripMode.season, tripMode.interest)
    : undefined;
  const scenes = useMemo(
    () =>
      events.filter((event) =>
        modeActive
          ? modeIds.has(event.id)
          : planMode
          ? event.start <= addDays(focus, span) &&
            event.end >= addDays(focus, -span)
          : isHappeningToday(event, new Date(clock ?? `${focus}T12:00:00Z`)),
      ),
    [events, modeActive, modeIds, planMode, focus, span, clock],
  );
  const upcoming = useMemo(
    () => (modeActive ? scenes : events).filter((event) => event.start > focus).slice(0, 4),
    [modeActive, scenes, events, focus],
  );
  const nearbyScenes = useMemo(() => {
    const coords = viewer.coords;
    if (!coords || viewer.status !== 'granted' || viewer.source === 'timezone') return [];
    return scenes
      .map((event) => ({
        event,
        distanceKm: greatCircleDistanceKm(coords, event.coords),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [scenes, viewer.coords, viewer.status, viewer.source]);

  const worldHeat = useMemo(
    () => [...scenes].sort((a, b) => a.buzz.rank - b.buzz.rank),
    [scenes],
  );

  const pulseScenes = planMode ? scenes : worldHeat;
  const destinationsIndex = useMemo(() => indexDestinations(EVENTS), []);
  const destinationHref = (eventId: string) => {
    const destination = destinationsIndex.byEventId.get(eventId);
    return destination
      ? `/destinations/${destination.slug}?event=${encodeURIComponent(eventId)}`
      : `/?event=${eventId}`;
  };
  useEffect(() => {
    track('world_opened', { surface: 'pulse' });
  }, []);
  const editorialSpotlight = modeActive
    ? modeEditorial
    : planMode ? scenes[0] : (nearbyScenes[0]?.event ?? worldHeat[0]);
  const { event: spotlight, selected: selectedStory } = resolveGlobeStory(
    selected ?? journeyEventId,
    calendar,
    editorialSpotlight,
  );
  const storyFocus = selectedStory || modeActive;
  const spotlightDistance =
    !storyFocus && !planMode ? spotlightNearestDistance(nearbyScenes, spotlight) : null;
  const destinations = new Set(
    scenes.map((event) => `${event.city},${event.country}`),
  ).size;
  const visibleIds = useMemo(
    () => new Set(scenes.map((event) => event.id)),
    [scenes],
  );
  const hasViewerOrigin = viewer.status === 'granted' &&
    (viewer.source === 'browser' || viewer.source === 'chosen') && Boolean(viewer.coords);
  const selectedRoute = storyFocus && spotlight && hasViewerOrigin && viewer.coords
    ? estimateRoute(viewer.coords, spotlight.coords)
    : null;
  const originName = hasViewerOrigin
    ? viewer.source === 'chosen' ? viewer.cityLabel?.split(',')[0] ?? 'Chosen city' : 'Your area'
    : null;
  const mountainView = spotlight && (spotlight.category === 'ski' || spotlight.secondaryCategories?.includes('ski'))
    ? {
        satellite: googleMapsViewUrl(spotlight.coords, 'satellite'),
        terrain: googleMapsViewUrl(spotlight.coords, 'terrain'),
      }
    : null;
  const visibleBeacons = beacons.filter((beacon) => visibleIds.has(beacon.eventId));

  const changeTripMode = (season: TripSeason, interest: TripInterest) => {
    navigateDiscovery({ season, interest, journey: null });
    select(null);
    if (routeTimer.current !== null) {
      window.clearTimeout(routeTimer.current);
      routeTimer.current = null;
    }
    const next = season === 'all' && interest === 'all'
      ? undefined
      : editorialEventForMode(EVENTS, focus, season, interest);
    flyTo(next?.coords ?? viewer.coords ?? { lat: 18, lon: 0 }, next ? 2.45 : OPENING_GLOBE_DISTANCE);
  };

  const travelFromCard = (event: WorldEvent) => {
    select(null);
    navigateDiscovery({ journey: event.id }, 'push');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const worldStage = document.getElementById('world-map');
    worldStage?.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    if (routeTimer.current !== null) window.clearTimeout(routeTimer.current);
    routeTimer.current = window.setTimeout(() => {
      worldStage?.focus({ preventScroll: true });
      travelTo(event.coords, hasViewerOrigin ? viewer.coords : null, 2.45);
      routeTimer.current = null;
    }, reducedMotion ? 0 : 380);
  };

  useEffect(() => () => {
    if (routeTimer.current !== null) window.clearTimeout(routeTimer.current);
  }, [syncLocalToday]);
  useEffect(() => {
    if (viewer.status !== 'granted' || !viewer.coords || linkedEventId) return;
    flyTo(viewer.coords, OPENING_GLOBE_DISTANCE);
  }, [viewer.status, viewer.coords, linkedEventId, flyTo]);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        select(null);
        const params = new URLSearchParams(window.location.search);
        if (params.has('journey')) router.replace(discoveryQuery(params, { journey: null }), { scroll: false });
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [select, router]);

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
          {planMode ? 'YOUR NEXT CHAPTER' : 'YOUR WORLD TO EXPLORE'}
          <span>
            {signalStatus === 'enriched'
              ? 'Updated signals'
              : signalStatus === 'offline'
                ? 'Curated calendar · offline'
                : 'Curated calendar'}{' '}
            · {dateLabel(focus)} ·{' '}
            <span aria-live="polite">
              {viewer.source === 'chosen'
                ? `Viewing ${viewer.cityLabel}${viewer.deviceFailure === 'denied'
                  ? ' · device location is blocked, still using this city'
                  : viewer.deviceFailure === 'unavailable' ? ' · device location unavailable, still using this city' : ''}`
                : viewer.status === 'granted'
                ? 'Using device location'
                : viewer.status === 'locating'
                  ? 'Locating you'
                  : viewer.status === 'denied'
                    ? 'Location is blocked in your browser · choose a city'
                    : viewer.status === 'unavailable'
                      ? 'Location unavailable · choose a city'
                      : 'Choose a city or use your location'}
            </span>
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
          onClick={() => {
            // A blocked browser cannot be re-prompted; send the traveler to the
            // city picker instead of a button that appears to do nothing.
            if (viewer.status === 'denied' || viewer.deviceFailure === 'denied') citySelect.current?.focus();
            else viewer.retry();
          }}
          disabled={viewer.status === 'locating'}
        >
          {viewer.status === 'denied' || viewer.deviceFailure === 'denied'
            ? 'Location blocked · pick a city'
            : viewer.source === 'chosen' ? 'Use device location' : viewer.status === 'granted'
            ? 'Recenter near me'
            : viewer.status === 'locating'
              ? 'Finding your position…'
              : 'Use my location'}
        </button>
        <label className={styles.cityChoice}>
          <span>Viewing area</span>
          <select ref={citySelect} aria-label="Choose your city" title="Your city choice is remembered in this tab" value={viewer.cityLabel ?? ''} onChange={(event) => viewer.chooseCity(event.target.value)}>
            <option value="" disabled>Choose your city</option>
            {VIEWER_CITIES.map((city) => <option value={city.name} key={city.name}>{city.name}</option>)}
          </select>
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
          {(tripMode.season !== 'all' || tripMode.interest !== 'all') && (
            <p className={styles.planModeNote} role="status">
              Showing everything in your dates. Your {modeLabel} picks come back when you return to today.
            </p>
          )}
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

      {!planMode && !query && <WorldIntro
        origin={hasViewerOrigin ? viewer.coords : null}
        originName={originName}
        onTravel={travelFromCard}
        season={tripMode.season}
        interest={tripMode.interest}
        onModeChange={changeTripMode}
      />}
      <nav className={styles.regions} aria-label="Explore map regions">
        <span>YOUR WORLD</span>
        {[
          { name: 'World', lat: 18, lon: 0, distance: 5.8 },
          { name: 'Americas', lat: 24, lon: -90, distance: 4.2 },
          { name: 'Europe', lat: 47, lon: 12, distance: 3.5 },
          { name: 'Asia Pacific', lat: 25, lon: 125, distance: 4.2 },
          { name: 'Africa', lat: 0, lon: 23, distance: 4.2 },
        ].map((region) => <button key={region.name} type="button" onClick={() => { setJourneyEventId(null); select(null); flyTo({ lat: region.lat, lon: region.lon }, region.distance); }}>{region.name}</button>)}
      </nav>
      <section id="world-map" className={styles.world} data-selected={storyFocus ? 'true' : undefined} aria-label="Explore the world map" tabIndex={-1}>
        <div className={styles.globe}>
          {viewer.coords ? (
            <GlobeStage
              beacons={visibleBeacons}
              winterMode={modeActive && tripMode.season === 'winter'}
              initialView={viewer.launchCoords ?? viewer.coords}
              viewerMarker={hasViewerOrigin && viewer.coords ? {
                coords: viewer.coords,
                label: viewer.source === 'chosen' ? (viewer.cityLabel?.split(',')[0].toUpperCase() ?? 'YOUR CITY') : 'NEARBY',
              } : undefined}
            />
          ) : (
            <div className={styles.globeBoot}>
              <span />
              <strong>Opening your part of the world…</strong>
            </div>
          )}
        </div>
        <div className={styles.worldHeading} data-selected={storyFocus ? 'true' : undefined}>
          <span className={styles.eyebrow}>
            {selectedStory
              ? 'YOUR SELECTED JOURNEY'
              : modeActive
              ? `YOUR ${modeLabel.toUpperCase()} SHORTLIST`
              : planMode
              ? 'GO WHERE THE MOMENT TAKES YOU'
              : 'PICK A PLACE. FIND YOUR PEOPLE.'}
          </span>
          <h2>
            {storyFocus && spotlight ? (
              <>
                {spotlight.city}{' '}
                <br />
                <em>is calling.</em>
              </>
            ) : planMode ? (
              <>
                Go find your{' '}
                <br />
                <em>next story.</em>
              </>
            ) : (
              <>
                The world is{' '}
                <br />
                <em>wide open.</em>
              </>
            )}
          </h2>
          <p>
            {storyFocus && spotlight
              ? `${spotlight.name} · ${formatDateRange(spotlight.start, spotlight.end)}`
              : planMode
              ? 'Follow the season, find your scene, and make it a trip.'
              : 'Spin the globe, follow a spark, and see where it leads.'}
          </p>
        </div>

        <div className={styles.spotlight} data-selected={storyFocus ? 'true' : undefined}>
          <div className={styles.eyebrow}>
            <span className={styles.spark}>✦</span>{' '}
            {selectedStory ? 'THIS IS YOUR DESTINATION' : modeActive ? 'FIRST ON YOUR SHORTLIST' : planMode ? 'IN YOUR TRAVEL WINDOW' : nearbyScenes.length ? 'NEAREST EVENT ON THE CALENDAR' : 'A SCENE TO EXPLORE'}
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
                {storyFocus
                  ? formatDateRange(spotlight.start, spotlight.end)
                  : `${dateLabel(spotlight.start)} — ${dateLabel(spotlight.end)}`}
                <span>
                  {storyFocus
                    ? spotlight.venues[0] ?? 'Curated occasion'
                    : planMode
                    ? 'In season'
                    : spotlightDistance != null
                      ? `≈${Math.round(spotlightDistance).toLocaleString()} km away · on the calendar today`
                      : 'On the calendar today'}
                </span>
              </div>
              {storyFocus && (
                <>
                  <span className={styles.storyLabel}>WHAT MAKES IT WORTH THE TRIP</span>
                  <ul className={styles.storyReasons} aria-label="What makes this event worth the trip">
                    {spotlight.whyGo.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  <div className={styles.storyRoute} aria-label="Indicative route">
                    <span>{originName ?? 'YOUR VIEW'}</span>
                    <span aria-hidden="true">→</span>
                    <span>{spotlight.city}</span>
                  </div>
                  <p className={styles.storyDistance}>
                    {selectedRoute
                      ? `${selectedRoute.distanceKm.toLocaleString()} km · ${selectedRoute.label}`
                      : 'Choose your city above to estimate the journey'}
                  </p>
                </>
              )}
              {mountainView?.satellite && mountainView.terrain && (
                <div className={styles.mountainHandoff}>
                  <span>THE MOUNTAIN LENS · APPROXIMATE AREA</span>
                  <div>
                    <a href={mountainView.satellite} target="_blank" rel="noopener noreferrer">
                      Satellite view ↗
                    </a>
                    <a href={mountainView.terrain} target="_blank" rel="noopener noreferrer">
                      Terrain &amp; contours ↗
                    </a>
                  </div>
                  <small>Opens the range near {spotlight.city} in Google Maps, not a verified lift entrance.</small>
                </div>
              )}
              {/* Sticky inside the scrolling spotlight so the next step never hides below its fold (UFR-A09, B11). */}
              <div className={styles.spotlightActions}>
                <Link className={styles.primary} href={destinationHref(spotlight.id)}>
                  Open {spotlight.city} <span>↗</span>
                </Link>
                <Link
                  className={styles.textLink}
                  href={`/circles?destination=${encodeURIComponent(destinationsIndex.byEventId.get(spotlight.id)?.slug ?? '')}&event=${encodeURIComponent(spotlight.id)}`}
                >
                  Start a Circle here →
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>No scenes in this view.</h2>
              <p>
                {query
                  ? planMode
                    ? 'Nothing in these dates matches. Try another city or interest, or clear your search.'
                    : 'This box only searches what is happening today. dope.travel search covers every place and date.'
                  : 'Great trips start a little ahead. Explore the calendar to find your next moment.'}
              </p>
              {query && (
                <button className={styles.primary} onClick={() => useCommandStore.getState().openWith(query)}>
                  Search all of dope.travel for “{query}”
                </button>
              )}
              <button
                className={styles.primary}
                onClick={query ? () => setQuery('') : beginPlanning}
              >
                {query ? 'Clear search' : 'Explore future dates'} <span>↗</span>
              </button>
            </>
          )}
          <small className={styles.disclosure}>
            {storyFocus
              ? 'Editorial event details; verify dates and access with organizers. Distance and airtime are indicative, not a flight schedule.'
              : signalStatus === 'enriched' && enrichedAt
              ? `Some signals updated ${new Date(enrichedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Rankings remain modeled, not a live attendance count.`
              : 'Editorial spotlight from curated event data. Popularity is modeled, not measured live.'}
          </small>
        </div>

        <aside className={styles.pulse} aria-label="The world pulse">
          <div className={styles.pulseHeading}>
            <div>
              <span className={styles.eyebrow}>{modeActive ? 'YOUR TRIP SHORTLIST' : planMode ? 'THE PULSE' : 'WORLD HEAT'}</span>
              <h2>{modeActive ? 'Places for this trip' : planMode ? 'On your horizon' : 'Places with a pull'}</h2>
            </div>
            <span className={styles.curated}>{signalStatus === 'enriched' ? 'UPDATED SIGNALS' : 'MODELED'}</span>
          </div>
          <p className={styles.pulseIntro}>
            {modeActive
              ? `${modeLabel}. Curated occasions ranked by modeled interest.`
              : planMode
              ? 'Standout occasions around your chosen dates.'
              : 'Curated occasions ranked by modeled travel interest.'}
          </p>
          {pulseScenes.slice(0, 3).map((event, index) => (
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
                  {modeActive
                    ? `${dateLabel(event.start)} · modeled heat ${Math.round(event.buzz.score)}/100`
                    : planMode
                    ? `${event.category} · ${dateLabel(event.start)}`
                    : `${event.buzz.heat} · heat ${Math.round(event.buzz.score)}/100`}
                </small>
              </span>
              <span className={styles.arrow}>↗</span>
            </Link>
          ))}
          {pulseScenes.length === 0 && (
            <p className={styles.noResults}>
              {modeActive
                ? 'No occasions match this trip mode and your other filters. Try another season or interest.'
                : 'No matching events. Change your dates or search to explore more of the calendar.'}
            </p>
          )}
          <LivePulse
            key={`${spotlight?.id}:${planMode}:${modeActive}`}
            eventId={spotlight?.id}
            planning={planMode || modeActive}
          />
        </aside>

        <div className={styles.worldStats}>
          <div>
            <strong>{scenes.length}</strong>
            <span>{modeActive ? 'occasions in mode' : planMode ? 'events in window' : 'events on today'}</span>
          </div>
          <div>
            <strong>{destinations}</strong>
            <span>destinations</span>
          </div>
          <div>
            <strong>{modeActive ? scenes.filter((event) => event.start > focus).length : events.length}</strong>
            <span>{modeActive ? 'future starts' : 'on the whole calendar'}</span>
          </div>
        </div>
        <div className={styles.globeHint}>
          DRAG TO ORBIT <span>·</span> PINCH OR ⌘/CTRL + SCROLL TO ZOOM
        </div>
        <div className={styles.globeControls}>
          <GlobeControls />
        </div>
      </section>

      {!planMode && !query && <LivingDashboard mode="feed" />}
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

      <section className={styles.directory}>
        <button onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? '−' : '+'} Browse all {scenes.length}{' '}
          {modeActive ? 'events for this trip' : planMode ? 'events in this window' : 'events on the calendar today'}
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
          dope.travel <small>THE WORLD, WELL LIVED.</small>
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
