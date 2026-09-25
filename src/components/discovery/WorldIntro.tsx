'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EVENTS } from '@/lib/data/events';
import { addDays, useTimelineStore } from '@/lib/stores/useTimelineStore';
import { estimateRoute } from '@/lib/travel/route-estimate';
import { approvedWikimediaUrl, type PlacePhoto } from '@/lib/place-media/media';
import { curatedPhotoForEvent, photoArchiveLabel } from '@/lib/place-media/curated';
import { photoImageProps } from '@/lib/place-media/sources';
import { indexDestinations } from '@/lib/pulse';
import { orderShortlistEvents, selectSeasonalEvents, type TripInterest, type TripSeason } from '@/lib/discovery/seasonal';
import { whyNow } from '@/lib/discovery/whyNow';
import type { GeoPoint, WorldEvent } from '@/lib/types';
import styles from './world-intro.module.css';
import { INTERESTS, SEASONS } from '@/components/trips/TripFinder';
import { HeroPool } from './HeroPool';
import { formatMiles } from '@/lib/units';

type RadarPick = { event: WorldEvent; slug: string };

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
  journeyId = null,
}: {
  /** The journey chosen elsewhere on the page (calendar, globe, a shared ?journey= link). */
  journeyId?: string | null;
  origin: GeoPoint | null;
  originName: string | null;
  onTravel: (event: WorldEvent) => void;
  season: TripSeason;
  interest: TripInterest;
}) {
  const focus = useTimelineStore((state) => state.focus);
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
      // rights-cleared image is still on the full calendar.
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
  const urlJourney = useMemo(() => (journeyId ? EVENTS.find((event) => event.id === journeyId) ?? null : null), [journeyId]);
  // With a location, something on now or starting within two weeks nearby beats a far-away editorial pick.
  const nearby = useMemo(() => {
    if (!origin || filtering) return null;
    const soonEnd = addDays(focus, 14);
    return EVENTS
      .filter((event) => event.end >= focus && event.start <= soonEnd)
      .map((event) => ({ event, km: estimateRoute(origin, event.coords).distanceKm }))
      .filter(({ km }) => km <= 150)
      .sort((a, b) => a.km - b.km || a.event.start.localeCompare(b.event.start))[0]?.event ?? null;
  }, [origin, filtering, focus]);
  const chosen = urlJourney ?? activeJourney?.event ?? null;
  const featured = chosen ?? nearby ?? picks[0]?.event;
  const featuredWhy = featured ? whyNow(featured, focus) : null;
  const estimate = origin && featured ? estimateRoute(origin, featured.coords) : null;
  const featuredPhoto = (featured ? curatedPhotoForEvent(featured.id) : null)
    ?? activeJourney?.photo
    ?? (featuredMedia?.eventId === featured?.id ? featuredMedia.photo : null);
  const displayedFeaturedPhoto = featuredPhoto?.imageUrl === failedFeaturedImage ? null : featuredPhoto;
  const story = HERO_STORIES[interest];
  const selectedSeasonLabel = SEASONS.find((option) => option.value === season)?.label ?? 'Every season';
  const selectedInterestLabel = INTERESTS.find((option) => option.value === interest)?.label ?? 'Anything';

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

  const launchJourney = (event: WorldEvent, photo: PlacePhoto | null = null) => {
    setActiveJourney({ event, photo });
    onTravel(event);
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
          <a className={styles.secondaryCta} href="#shortlist">See what is calling <span aria-hidden="true">↓</span></a>
          </div>
          {featured && featuredWhy && (
            // Phones show the pass card below the fold, so the what and when ride under the button too.
            <p className={styles.heroWhen}>{featured.name} · {featuredWhy.when}</p>
          )}
        </div>
        {featured && <div className={styles.routePass} aria-label={`Featured journey to ${featured.city}`}>
          <div className={styles.passTop}><span>{chosen ? 'YOUR SELECTED JOURNEY' : featured === nearby ? 'NEAR YOU' : featuredWhy?.tone === 'now' ? 'HAPPENING NOW' : featuredWhy?.tone === 'soon' ? 'STARTING SOON' : 'WORTH PLANNING NOW'}</span><span aria-hidden="true">✦ dope.travel</span></div>
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
            <strong>{estimate ? `${formatMiles(estimate.distanceKm)} · ${estimate.label}` : 'Choose your city for a route estimate'}</strong>
          </div>
          {featuredWhy?.reason && <p className={styles.passWhy}>{featuredWhy.reason}{featuredWhy.planBy ? <span data-urgency={featuredWhy.planBy.urgency}> · {featuredWhy.planBy.label}</span> : null}</p>}
          <small className={styles.passFoot}>{estimate ? 'Indicative straight-line distance and airtime; no live flight schedule.' : 'Flight animation begins from your current globe view.'}</small>
          {displayedFeaturedPhoto && <a className={styles.passCredit} href={displayedFeaturedPhoto.sourceUrl} target="_blank" rel="noopener noreferrer">Photo: {displayedFeaturedPhoto.credit} · {displayedFeaturedPhoto.license} ↗</a>}
        </div>}
      </div>

      <div className={styles.radar} id="shortlist">
        <div className={styles.radarHeading}>
          <div><span className={styles.kicker}><span className={`horizon-band ${styles.band}`} aria-hidden="true" />{filtering ? `${selectedSeasonLabel.toUpperCase()} / ${selectedInterestLabel.toUpperCase()}` : 'THE SHORTLIST / 001'}</span><h2>{story.heading}</h2></div>
          <p>{filtering ? 'Current and future occasions on the curated calendar. Tap a place to explore.' : 'Tap a place to fly there. Then follow the story.'}</p>
        </div>
        {picks.length ? <div className={styles.radarCards} role="list" aria-label="Places on the radar">
          {picks.map((pick, index) => <div role="listitem" key={pick.event.id}><RadarCard pick={pick} index={index} today={focus} onTravel={launchJourney} /></div>)}
        </div> : <p className={styles.emptySelection}>No upcoming calendar entries match this combination. Try another season or interest.</p>}
        <div className={styles.radarDisclosure}>Destinations from the curated calendar. Photo labels link to licensed Wikimedia Commons archive imagery and may show earlier years. Demand is modeled.</div>
      </div>

    </section>
  );
}
