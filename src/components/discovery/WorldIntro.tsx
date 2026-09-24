'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EVENTS } from '@/lib/data/events';
import { addDays, daysBetween, useTimelineStore } from '@/lib/stores/useTimelineStore';
import { estimateRoute } from '@/lib/travel/route-estimate';
import { approvedWikimediaUrl, type PlacePhoto } from '@/lib/place-media/media';
import { curatedPhotoForEvent, photoArchiveLabel } from '@/lib/place-media/curated';
import { photoImageProps } from '@/lib/place-media/sources';
import { indexDestinations } from '@/lib/pulse';
import { orderShortlistEvents, selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';
import { whyNow } from '@/lib/discovery/whyNow';
import type { GeoPoint, WorldEvent } from '@/lib/types';
import styles from './world-intro.module.css';
import { HeroPool } from './HeroPool';

type RadarPick = { event: WorldEvent; slug: string };

const SEASONS: { value: TripSeason; label: string; defaultInterest: TripInterest }[] = [
  { value: 'all', label: 'Every season', defaultInterest: 'all' },
  { value: 'winter', label: 'Winter', defaultInterest: 'ski' },
  { value: 'spring', label: 'Spring', defaultInterest: 'adventure' },
  { value: 'summer', label: 'Summer', defaultInterest: 'coast' },
  { value: 'fall', label: 'Fall', defaultInterest: 'culture' },
];

const INTERESTS: { value: TripInterest; label: string }[] = [
  { value: 'all', label: 'Anything', },
  { value: 'ski', label: 'Ski & snow' },
  { value: 'coast', label: 'Coast & water' },
  { value: 'adventure', label: 'Nature & adventure' },
  { value: 'culture', label: 'Culture & food' },
];

const HERO_STORIES: Record<TripInterest, { first: string; emphasis: string; description: string; heading: string }> = {
  all: {
    first: 'The best stories', emphasis: 'start somewhere.',
    description: 'Find the moment. Follow the feeling. See how far a single place can take you.',
    heading: 'Worth catching now.',
  },
  ski: {
    first: 'A winter together', emphasis: 'starts here.',
    description: 'Compare the ski weeks, the towns, and the moments worth gathering everyone for.',
    heading: 'Ski weeks worth planning.',
  },
  coast: {
    first: 'Follow the water', emphasis: 'somewhere new.',
    description: 'Find a coastal occasion, then build the days on either side around your people.',
    heading: 'Days by the water.',
  },
  adventure: {
    first: 'Take the road', emphasis: 'less expected.',
    description: 'Start with a remarkable place, then explore what an active trip there could become.',
    heading: 'Go further afield.',
  },
  culture: {
    first: 'Go for the moment.', emphasis: 'Stay for the place.',
    description: 'An occasion gives the trip a date. The city gives everyone a story to bring home.',
    heading: 'Follow the story.',
  },
};

function approvedHeroPhoto(event: WorldEvent, photos: PlacePhoto[] | undefined): PlacePhoto | null {
  const curated = curatedPhotoForEvent(event.id);
  if (curated) return curated;
  return photos?.find((item) =>
    approvedWikimediaUrl(item.imageUrl, 'image') && approvedWikimediaUrl(item.sourceUrl, 'source')) ?? null;
}

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

function calendarTiming(event: WorldEvent, focus: string) {
  if (event.start <= focus && event.end >= focus) {
    return { phase: 'now' as const, label: 'NOW', detail: 'Calendar today' };
  }
  const leadDays = Math.max(0, daysBetween(focus, event.start));
  if (leadDays <= 7) {
    return { phase: 'soon' as const, label: 'SOON', detail: leadDays === 0 ? 'Starts today' : `In ${leadDays} day${leadDays === 1 ? '' : 's'}` };
  }
  return { phase: 'plan' as const, label: 'PLAN', detail: `${leadDays} days ahead` };
}

function RadarCard({ pick, index, today, onTravel }: { pick: RadarPick; index: number; today: string; onTravel: (event: WorldEvent, photo: PlacePhoto | null) => void }) {
  const { event, slug } = pick;
  const why = whyNow(event, today);
  const [photo, setPhoto] = useState<PlacePhoto | null>(() => curatedPhotoForEvent(event.id));
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    const curated = curatedPhotoForEvent(event.id);
    if (curated) {
      setPhoto(curated);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/place-media?eventId=${encodeURIComponent(event.id)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ photos?: PlacePhoto[] }> : { photos: [] })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPhoto(approvedHeroPhoto(event, result.photos));
      })
      .catch(() => {
        if (!controller.signal.aborted) setPhoto(null);
      });
    return () => controller.abort();
  }, [event]);

  return (
    <article className={styles.radarCard} data-tone={index % 6}>
      <div className={styles.cardVisual} aria-hidden="true">
        {photo && !imageFailed ? (
          // Commons URLs are validated by the server and again above before display.
          // eslint-disable-next-line @next/next/no-img-element
          <img {...photoImageProps(photo, 'card')} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
        ) : null}
      </div>
      <button type="button" className={styles.cardFlight} onClick={() => onTravel(event, imageFailed ? null : photo)} aria-label={`Fly across the globe to ${event.city} for ${event.name}`}>
        <span className={styles.cardTop}><span>{event.category}</span><span>{dateLabel(event.start)}</span></span>
        <span className={styles.cardCity}>{event.city}</span>
        <span className={styles.cardEvent}>{event.name}</span>
        <span className={styles.cardWhen} data-tone={why.tone}>{why.when}</span>
        {why.planBy && <span className={styles.cardPlan} data-urgency={why.planBy.urgency}>{why.planBy.label}</span>}
        <span className={styles.cardFly}><span aria-hidden="true">✈</span> Fly there on the globe <span aria-hidden="true">↗</span></span>
      </button>
      <div className={styles.cardBottom}>
        <Link href={`/destinations/${slug}?event=${encodeURIComponent(event.id)}`}>Explore the place <span aria-hidden="true">↗</span></Link>
        {photo && !imageFailed ? (
          <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" title={`${photo.title} · ${photo.credit} · ${photo.license}`}>
            {photoArchiveLabel(photo)} · {photo.credit} · {photo.license} ↗
          </a>
        ) : <span>Photo being sourced</span>}
      </div>
    </article>
  );
}

export function WorldIntro({
  origin,
  originName,
  onTravel,
  season,
  interest,
  onModeChange,
}: {
  origin: GeoPoint | null;
  originName: string | null;
  onTravel: (event: WorldEvent) => void;
  season: TripSeason;
  interest: TripInterest;
  onModeChange: (season: TripSeason, interest: TripInterest) => void;
}) {
  const focus = useTimelineStore((state) => state.focus);
  const board = useRef<HTMLDivElement>(null);
  const boardGroup = useRef<HTMLDivElement>(null);
  const touchPauseTimer = useRef<number | null>(null);
  const [boardHovered, setBoardHovered] = useState(false);
  const [boardFocused, setBoardFocused] = useState(false);
  const [boardTouched, setBoardTouched] = useState(false);
  const [boardPaused, setBoardPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [activeJourney, setActiveJourney] = useState<{ event: WorldEvent; photo: PlacePhoto | null } | null>(null);
  const [featuredMedia, setFeaturedMedia] = useState<{ eventId: string; photo: PlacePhoto | null } | null>(null);
  const [failedFeaturedImage, setFailedFeaturedImage] = useState<string | null>(null);
  const destinations = useMemo(() => indexDestinations(EVENTS, focus), [focus]);
  const filtering = season !== 'all' || interest !== 'all';
  const seasonalEvents = useMemo(() => selectSeasonalEvents(EVENTS, focus, season, interest), [focus, season, interest]);
  const picks = useMemo(() => {
    if (filtering) {
      const seen = new Set<string>();
      const selected: RadarPick[] = [];
      const ranked = orderShortlistEvents(seasonalEvents, interest);
      // Lead with photographed scenes in curated visual shortlists. A missing
      // rights-cleared image stays discoverable in the departure board.
      const photographed = ranked.filter((event) => curatedPhotoForEvent(event.id));
      const candidates = photographed.length >= 4 ? photographed : ranked;
      for (const event of candidates) {
        const place = destinations.byEventId.get(event.id);
        if (!place || seen.has(place.slug)) continue;
        seen.add(place.slug);
        selected.push({ event, slug: place.slug });
        if (selected.length === 6) break;
      }
      return selected;
    }
    const windowIds = new Set(EVENTS.filter((event) => event.end >= focus && event.start <= addDays(focus, 45)).map((event) => event.id));
    const inWindow = destinations.pulses.filter((place) => place.eventIds.some((id) => windowIds.has(id)));
    const candidates = inWindow.length ? inWindow : destinations.pulses;
    return candidates.slice(0, 6).flatMap((place): RadarPick[] => {
      const event = EVENTS.find((item) => place.eventIds.includes(item.id) && windowIds.has(item.id))
        ?? EVENTS.find((item) => place.eventIds.includes(item.id));
      return event ? [{ event, slug: place.slug }] : [];
    });
  }, [destinations, focus, filtering, interest, seasonalEvents]);
  const featured = activeJourney?.event ?? picks[0]?.event;
  const featuredWhy = featured ? whyNow(featured, focus) : null;
  const estimate = origin && featured ? estimateRoute(origin, featured.coords) : null;
  const departures = useMemo(() => {
    if (filtering) return seasonalEvents.slice(0, 12);
    const current = EVENTS.filter((event) => event.start <= focus && event.end >= focus)
      .sort((a, b) => a.end.localeCompare(b.end)).slice(0, 3);
    const soonEnd = addDays(focus, 7);
    const soon = EVENTS.filter((event) => event.start > focus && event.start <= soonEnd).slice(0, 4);
    const planning = EVENTS.filter((event) => event.start > soonEnd).slice(0, 5);
    return [...current, ...soon, ...planning];
  }, [focus, filtering, seasonalEvents]);
  const featuredPhoto = (featured ? curatedPhotoForEvent(featured.id) : null)
    ?? activeJourney?.photo
    ?? (featuredMedia?.eventId === featured?.id ? featuredMedia.photo : null);
  const displayedFeaturedPhoto = featuredPhoto?.imageUrl === failedFeaturedImage ? null : featuredPhoto;
  const story = HERO_STORIES[interest];
  const selectedSeasonLabel = SEASONS.find((option) => option.value === season)?.label ?? 'Every season';
  const selectedInterestLabel = INTERESTS.find((option) => option.value === interest)?.label ?? 'Anything';
  const familySki = season === 'winter' && interest === 'ski';

  const chooseSeason = (next: TripSeason) => {
    onModeChange(next, SEASONS.find((option) => option.value === next)?.defaultInterest ?? 'all');
    setActiveJourney(null);
    if (board.current) board.current.scrollLeft = 0;
  };

  const chooseInterest = (next: TripInterest) => {
    onModeChange(season, next);
    setActiveJourney(null);
    if (board.current) board.current.scrollLeft = 0;
  };

  useEffect(() => {
    if (!featured) return;
    const curated = curatedPhotoForEvent(featured.id);
    if (curated) {
      setFeaturedMedia({ eventId: featured.id, photo: curated });
      return;
    }
    const controller = new AbortController();
    fetch(`/api/place-media?eventId=${encodeURIComponent(featured.id)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ photos?: PlacePhoto[] }> : { photos: [] })
      .then((result) => {
        if (controller.signal.aborted) return;
        setFeaturedMedia({ eventId: featured.id, photo: approvedHeroPhoto(featured, result.photos) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFeaturedMedia({ eventId: featured.id, photo: null });
      });
    return () => controller.abort();
  }, [featured]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const viewport = board.current;
    const group = boardGroup.current;
    if (!viewport || !group || !departures.length || boardHovered || boardFocused || boardTouched || boardPaused || reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    let visible = false;
    let lastTime = 0;
    const tick = (time: number) => {
      if (!visible) return;
      const elapsed = lastTime ? Math.min(time - lastTime, 40) : 0;
      lastTime = time;
      if (document.visibilityState === 'visible' && group.scrollWidth > viewport.clientWidth) {
        viewport.scrollLeft += elapsed * 0.035;
        if (viewport.scrollLeft >= group.scrollWidth) viewport.scrollLeft -= group.scrollWidth;
      }
      frame = window.requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      window.cancelAnimationFrame(frame);
      if (visible) {
        lastTime = 0;
        frame = window.requestAnimationFrame(tick);
      }
    }, { threshold: 0.1 });
    observer.observe(viewport);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [departures, boardHovered, boardFocused, boardTouched, boardPaused, reducedMotion]);

  useEffect(() => () => {
    if (touchPauseTimer.current !== null) window.clearTimeout(touchPauseTimer.current);
  }, []);

  const launchJourney = (event: WorldEvent, photo: PlacePhoto | null = null) => {
    setActiveJourney({ event, photo });
    onTravel(event);
  };

  const scrollBoard = (direction: number) => {
    board.current?.scrollBy({
      left: direction * Math.max(270, board.current.clientWidth * 0.65),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  const departureItem = (event: WorldEvent, duplicate: boolean) => {
    const timing = calendarTiming(event, focus);
    return <button
      key={`${duplicate ? 'copy' : 'original'}-${event.id}`}
      type="button"
      tabIndex={duplicate ? -1 : undefined}
      data-phase={timing.phase}
      onClick={() => launchJourney(event)}
      aria-label={duplicate ? undefined : `Fly to ${event.city} for ${event.name}. ${timing.label}: ${timing.detail}. Starts ${dateLabel(event.start)}.`}
    >
      <span className={styles.boardTiming}><b>{timing.label}</b><small>{timing.detail}</small></span>
      <span className={styles.boardDestination}><strong>{event.city}</strong><em>{event.name}</em></span>
      <span className={styles.boardDate}>{dateLabel(event.start)}</span>
      <span className={styles.boardArrow} aria-hidden="true">↗</span>
    </button>;
  };

  return (
    <section className={styles.intro} aria-label="Discover your next journey">
      <div className={styles.hero}>
        <div className={styles.heroPhoto} aria-hidden="true" />
        <HeroPool />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <span className={styles.kicker}><span aria-hidden="true">✦</span> THE WORLD IS AN INVITATION</span>
          <h1>{story.first} <em>{story.emphasis}</em></h1>
          <p>{story.description}</p>
          <div className={styles.heroActions}>
          {featured && (estimate?.airHours === 0 && destinations.byEventId.get(featured.id) ? (
            // Already there: flying a route to your own city makes no sense (red team UFR-C10).
            <Link className={`btn btn-primary ${styles.heroCta}`} href={`/destinations/${destinations.byEventId.get(featured.id)!.slug}?event=${encodeURIComponent(featured.id)}`}>
              You&apos;re here · see {featured.city} <span aria-hidden="true">↗</span>
            </Link>
          ) : (
            <button type="button" className={`btn btn-primary ${styles.heroCta}`} onClick={() => launchJourney(featured, activeJourney?.photo)}>
              <span className={styles.jet} aria-hidden="true">✈</span> Fly to {featured.city} <span aria-hidden="true">↗</span>
            </button>
          ))}
          <a className={styles.secondaryCta} href="#departure-board">See what is calling <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        {featured && <div className={styles.routePass} aria-label={`Featured journey to ${featured.city}`}>
          <div className={styles.passTop}><span>{activeJourney ? 'YOUR SELECTED JOURNEY' : featuredWhy?.tone === 'now' ? 'HAPPENING NOW' : featuredWhy?.tone === 'soon' ? 'STARTING SOON' : 'WORTH PLANNING NOW'}</span><span aria-hidden="true">✦ dope.travel</span></div>
          <div className={styles.passPicture}>
            {displayedFeaturedPhoto ? (
              // Curated images are local; Commons search results were checked before storage.
              // eslint-disable-next-line @next/next/no-img-element
              <img {...photoImageProps(displayedFeaturedPhoto, 'pass')} alt="" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedFeaturedImage(displayedFeaturedPhoto.imageUrl)} />
            ) : null}
            <span>{displayedFeaturedPhoto ? photoArchiveLabel(displayedFeaturedPhoto) : 'Photo being sourced'}</span>
          </div>
          <div className={styles.passRoute}>
            <span className={styles.passPlace}><small>FROM</small><strong>{originName ?? 'YOUR VIEW'}</strong></span>
            <span className={styles.passLine} aria-hidden="true"><i />✈<i /></span>
            <span className={styles.passPlace}><small>TO</small><strong>{featured.city}</strong></span>
          </div>
          <div className={styles.passMeta}>
            <span>{featured.name} · {featuredWhy?.when ?? dateLabel(featured.start)}</span>
            <strong>{estimate ? `${estimate.distanceKm.toLocaleString()} km · ${estimate.label}` : 'Choose your city for a route estimate'}</strong>
          </div>
          {featuredWhy?.reason && <p className={styles.passWhy}>{featuredWhy.reason}{featuredWhy.planBy ? <span data-urgency={featuredWhy.planBy.urgency}> · {featuredWhy.planBy.label}</span> : null}</p>}
          <small className={styles.passFoot}>{estimate ? 'Indicative straight-line distance and airtime; no live flight schedule.' : 'Flight animation begins from your current globe view.'}</small>
          {displayedFeaturedPhoto && <a className={styles.passCredit} href={displayedFeaturedPhoto.sourceUrl} target="_blank" rel="noopener noreferrer">Photo: {displayedFeaturedPhoto.credit} · {displayedFeaturedPhoto.license} ↗</a>}
        </div>}
      </div>

      <section className={styles.tripFinder} aria-labelledby="trip-finder-title">
        <div className={styles.finderIntro}>
          <div>
            <span className={styles.kicker}><span className={`horizon-band ${styles.band}`} aria-hidden="true" />START WITH A FEELING / 001</span>
            <h2 id="trip-finder-title">What kind of trip calls to you?</h2>
            <p>Choose when and what you love. The places and departure board will follow.</p>
          </div>
          <div className={`surface ${styles.finderSelection}`} aria-live="polite">
            <span className="eyebrow">YOUR EDITORIAL SHORTLIST</span>
            <strong>{selectedSeasonLabel} · {selectedInterestLabel}</strong>
            <small>{filtering ? `${picks.length} places to explore` : 'A little of everything'}</small>
            <Link className="btn btn-ghost" href={`/trips?season=${season}&interest=${interest}${familySki ? '#family-ski' : ''}`}>
              {familySki ? 'Start a family ski trip' : 'Explore trip planning'} <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className={styles.finderControls}>
          <fieldset className={styles.finderGroup}>
            <legend>When</legend>
            <div>{SEASONS.map((option) => <button key={option.value} type="button" className="chip" aria-pressed={season === option.value} onClick={() => chooseSeason(option.value)}>{option.label}</button>)}</div>
          </fieldset>
          <fieldset className={styles.finderGroup}>
            <legend>What</legend>
            <div>{INTERESTS.map((option) => <button key={option.value} type="button" className="chip" aria-pressed={interest === option.value} onClick={() => chooseInterest(option.value)}>{option.label}</button>)}</div>
          </fieldset>
        </div>
        {interest === 'ski' && <div className={styles.snowOutlook} role="note">
          <div><span>SNOW OUTLOOK</span><strong>Plan the week. Check the mountain.</strong></div>
          <p>These are curated ski dates, not a snow report. Snow depth, recent snowfall, forecast, open lifts, and family terrain still need a verified resort or weather source before you decide where conditions are best.</p>
          <span className={`tag ${styles.snowStatus}`}>LIVE CONDITIONS · SOURCE NEEDED</span>
          <div className={styles.snowLinks} aria-label="Official mountain condition reports">
            <span>CHECK OFFICIAL REPORTS ↗</span>
            <a href="https://www.aspensnowmass.com/four-mountains/aspen-mountain/snow-and-grooming-report" target="_blank" rel="noopener noreferrer">Aspen Snowmass</a>
            <a href="https://www.engadin.ch/en/reports/snowsports-report" target="_blank" rel="noopener noreferrer">St. Moritz / Engadin</a>
            <a href="https://verbier4vallees.ch/en/useful-information/live-information-winter" target="_blank" rel="noopener noreferrer">Verbier</a>
            <a href="https://zermatt.swiss/en/info/weather/snow-report" target="_blank" rel="noopener noreferrer">Zermatt</a>
          </div>
        </div>}
        <p className={styles.finderDisclosure}>Season means the event&apos;s calendar month, in the Northern Hemisphere travel calendar. These are editorial ideas, not live snow, forecast, activity, lodging, or price results.</p>
      </section>

      <div className={styles.radar} id="departure-board">
        <div className={styles.radarHeading}>
          <div><span className={styles.kicker}><span className={`horizon-band ${styles.band}`} aria-hidden="true" />{filtering ? `${selectedSeasonLabel.toUpperCase()} / ${selectedInterestLabel.toUpperCase()}` : 'THE SHORTLIST / 001'}</span><h2>{story.heading}</h2></div>
          <p>{filtering ? 'Current and future occasions on the curated calendar. Tap a place to explore.' : 'Tap a place to fly there. Then follow the story.'}</p>
        </div>
        {picks.length ? <div className={styles.radarCards} role="list" aria-label="Places on the radar">
          {picks.map((pick, index) => <div role="listitem" key={pick.event.id}><RadarCard pick={pick} index={index} today={focus} onTravel={launchJourney} /></div>)}
        </div> : <p className={styles.emptySelection}>No upcoming calendar entries match this combination. Try another season or interest.</p>}
        <div className={styles.radarDisclosure}>Destinations from the curated calendar. Photo labels link to licensed Wikimedia Commons archive imagery and may show earlier years. Demand is modeled.</div>
      </div>

      <div
        className={styles.departureBoard}
        role="region"
        aria-label="Departure board from the curated calendar"
        onMouseEnter={() => setBoardHovered(true)}
        onMouseLeave={() => setBoardHovered(false)}
        onFocusCapture={() => setBoardFocused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setBoardFocused(false); }}
        onTouchStart={() => {
          if (touchPauseTimer.current !== null) window.clearTimeout(touchPauseTimer.current);
          setBoardTouched(true);
        }}
        onTouchEnd={() => {
          touchPauseTimer.current = window.setTimeout(() => setBoardTouched(false), 3500);
        }}
      >
        <div className={styles.boardLabel}><span aria-hidden="true">✧</span><span><strong>THE DEPARTURE BOARD</strong><small>Editorial calendar · verify dates</small></span></div>
        <div className={styles.boardTrack} ref={board}>
          <div className={styles.boardMotion}>
            <div className={styles.boardGroup} ref={boardGroup}>{departures.length ? departures.map((event) => departureItem(event, false)) : <p className={styles.boardEmpty}>No upcoming departures for this selection</p>}</div>
            <div className={styles.boardGroup} aria-hidden="true">{departures.map((event) => departureItem(event, true))}</div>
          </div>
        </div>
        <div className={styles.boardControls}>
          <button type="button" className={`btn btn-ghost ${styles.boardPause}`} onClick={() => setBoardPaused((value) => !value)} disabled={reducedMotion} aria-label={reducedMotion ? 'Automatic movement is off for reduced motion' : boardPaused ? 'Resume departure ticker' : 'Pause departure ticker'} aria-pressed={boardPaused || reducedMotion}>{boardPaused || reducedMotion ? '▶' : 'Ⅱ'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => scrollBoard(-1)} aria-label="Scroll departures left">‹</button>
          <button type="button" className="btn btn-ghost" onClick={() => scrollBoard(1)} aria-label="Scroll departures right">›</button>
        </div>
      </div>
    </section>
  );
}
