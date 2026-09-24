'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DesignerDestination } from '@/lib/designer/catalog';
import { cityAirport, originAirport } from '@/lib/designer/airports';
import type { Itinerary } from '@/lib/designer/itinerary';
import { scenePlaybook } from '@/lib/designer/scene';
import type {
  DestinationResearch as Research,
  FlightSection,
  ResearchEvent,
  ResearchPost,
  ResearchSection,
  ResearchSpot,
} from '@/lib/research/destinationSources';
import styles from './designer.module.css';

const STORE_PREFIX = 'dope.research.v1:';
const FRESH_MS = 6 * 60 * 60 * 1000;

type TabId = 'topSpots' | 'hiddenGems' | 'food' | 'nightlife' | 'tripadvisor' | 'yelp' | 'instagram' | 'tiktok' | 'events' | 'flights';
const TABS: { id: TabId; label: string }[] = [
  { id: 'topSpots', label: 'Top spots' },
  { id: 'hiddenGems', label: 'Hidden gems' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'food', label: 'Eat' },
  { id: 'nightlife', label: 'Nights out' },
  { id: 'tripadvisor', label: 'Tripadvisor' },
  { id: 'yelp', label: 'Yelp' },
  { id: 'events', label: 'Events' },
  { id: 'flights', label: 'Flights' },
];

function readStored(key: string): Research | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Research;
    return typeof value?.generatedAt === 'string' && Date.now() - Date.parse(value.generatedAt) < FRESH_MS ? value : null;
  } catch {
    return null;
  }
}

function store(key: string, value: Research) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the panel still works for this visit.
  }
}

function ago(iso: string | null): string {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function Photo({ src, alt, tall }: { src?: string; alt?: string; tall?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={`${styles.researchPhoto} ${tall ? styles.researchPhotoTall : ''} ${styles.researchPhotoEmpty}`} aria-hidden />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- remote listing photos, shown as the provider serves them */
    <img className={`${styles.researchPhoto} ${tall ? styles.researchPhotoTall : ''}`} src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

function SpotCard({ spot }: { spot: ResearchSpot }) {
  return (
    <a className={styles.researchCard} href={spot.url} target="_blank" rel="noopener noreferrer">
      <Photo src={spot.image?.url} alt={spot.image?.alt} />
      <span className={styles.researchBody}>
        <span className={styles.researchName}>{spot.name}</span>
        <span className={styles.researchMeta}>
          {spot.rating !== undefined ? `★ ${spot.rating.toFixed(1)}` : ''}
          {spot.reviews !== undefined ? ` (${compact(spot.reviews)})` : ''}
          {spot.price ? ` · ${spot.price}` : ''}
          {spot.category ? ` · ${spot.category}` : ''}
        </span>
        {spot.snippet ? <span className={styles.researchSnippet}>“{spot.snippet}”</span> : spot.address ? <span className={styles.researchSnippet}>{spot.address}</span> : null}
        <span className={styles.researchSource}>{spot.source} ↗</span>
      </span>
    </a>
  );
}

function PostCard({ post }: { post: ResearchPost }) {
  return (
    <a className={styles.researchCard} href={post.url} target="_blank" rel="noopener noreferrer">
      <Photo src={post.image?.url} alt={post.image?.alt} tall />
      <span className={styles.researchBody}>
        <span className={styles.researchMeta}>
          @{post.author} · {ago(post.publishedAt)}
          {post.views !== undefined ? ` · ${compact(post.views)} views` : ''}
        </span>
        <span className={styles.researchSnippet}>{post.caption}</span>
        <span className={styles.researchSource}>
          {post.platform}
          {post.location ? ` · ${post.location}` : ` · ${post.about}`} ↗
        </span>
      </span>
    </a>
  );
}

function EventCard({ event }: { event: ResearchEvent }) {
  return (
    <a className={styles.researchCard} href={event.url} target="_blank" rel="noopener noreferrer">
      <Photo src={event.image?.url} alt={event.image?.alt} />
      <span className={styles.researchBody}>
        <span className={styles.researchName}>{event.title}</span>
        <span className={styles.researchMeta}>{event.when}{event.venue ? ` · ${event.venue}` : ''}</span>
        <span className={styles.researchSource}>Google Events ↗</span>
      </span>
    </a>
  );
}

function Flights({ section }: { section: FlightSection }) {
  const hours = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  return (
    <div className={styles.stayGrid}>
      {section.items.map((flight) => (
        <a key={flight.id} className={styles.stayLink} href={section.link ?? 'https://www.google.com/travel/flights'} target="_blank" rel="noopener noreferrer">
          <span className={styles.stayName}>${flight.price.toLocaleString()}</span>
          <span className="text-[13px] text-ink">{flight.airlines.join(' + ') || 'Airline not listed'}</span>
          <span className="text-[12px] text-ink-muted">
            {flight.from} → {flight.to} · {flight.stops === 0 ? 'nonstop' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`} · {hours(flight.durationMin)}
          </span>
          <span className="text-[11px] text-ink-subtle">Departs {flight.departs.replace(' ', ' at ')}</span>
        </a>
      ))}
    </div>
  );
}

function SectionBody({ id, section }: { id: TabId; section: ResearchSection<unknown> }) {
  if (section.status !== 'ok') return <div className={styles.stripEmpty}>{section.note ?? 'Nothing here yet.'}</div>;
  if (id === 'flights') return <Flights section={section as FlightSection} />;
  return (
    <div className={styles.strip}>
      {id === 'instagram' || id === 'tiktok'
        ? (section.items as ResearchPost[]).map((post) => <PostCard key={post.id} post={post} />)
        : id === 'events'
          ? (section.items as ResearchEvent[]).map((event) => <EventCard key={event.id} event={event} />)
          : (section.items as ResearchSpot[]).map((spot) => <SpotCard key={spot.id} spot={spot} />)}
    </div>
  );
}

function footnote(id: TabId, section: ResearchSection<unknown>): string {
  const when = section.fetchedAt ? `, fetched ${ago(section.fetchedAt)}` : '';
  if (id === 'flights') {
    const flights = section as FlightSection;
    const route = flights.route ? `${flights.route.from} ⇄ ${flights.route.to}, ${flights.route.depart} to ${flights.route.return}. ` : '';
    const typical = flights.typical ? `Typical for this route: $${flights.typical[0]}–$${flights.typical[1]}. ` : '';
    return `${route}${typical}Round trip, one adult, economy, from ${section.source}${when}. Fares move fast; confirm before you book.`;
  }
  if (id === 'hiddenGems') return `${section.note ?? ''} From ${section.source}${when}.`;
  if (id === 'instagram' || id === 'tiktok') return `Recent public posts from ${section.source}${when}. Tap through to see them on ${section.source}.`;
  return `From ${section.source}${when}. Listings and ratings are theirs; check hours and bookings with each place.`;
}

/** Live research for the trip's place: real listings and posts, each labeled with source and fetch time. */
export function DestinationResearch({ trip, destination }: { trip: Itinerary; destination: DesignerDestination }) {
  const name = destination.id === 'maldives' ? 'Male' : destination.name;
  const request = useMemo(() => {
    const scene = trip.taste ? scenePlaybook(trip.taste, 1)[0]?.label : undefined;
    const from = originAirport(trip.hometown);
    const to = destination.gateway.iata || cityAirport(destination.name);
    return {
      name,
      region: destination.region || undefined,
      scene,
      ...(from && to ? { from, to, depart: trip.startDate, nights: trip.nights } : {}),
    };
  }, [name, destination.region, destination.gateway.iata, destination.name, trip.taste, trip.hometown, trip.startDate, trip.nights]);
  const key = `${STORE_PREFIX}${JSON.stringify(request)}`;
  const [research, setResearch] = useState<Research | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (!force) {
      const stored = readStored(key);
      if (stored) {
        setResearch(stored);
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/designer/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const body = (await response.json()) as Research | { error?: string };
      if (!response.ok || !('topSpots' in body)) throw new Error(('error' in body && body.error) || 'Research is unavailable right now.');
      setResearch(body);
      if (body.configured) store(key, body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Research is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [key, request]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const tabs = research ? TABS.filter(({ id }) => research[id].status !== 'skipped' || id === 'flights') : [];
  const active: TabId = tab ?? tabs.find(({ id }) => research?.[id].status === 'ok')?.id ?? 'topSpots';
  const current = research?.[active];

  return (
    <section className={styles.panel} aria-labelledby="research-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p id="research-title" className={styles.factTitle}>
          {name}, right now
        </p>
        {research?.configured ? (
          <button type="button" className={styles.miniBtn} onClick={() => void load(true)} disabled={loading}>
            {loading ? 'Looking…' : 'Refresh'}
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] leading-5 text-ink-muted">
        Real places and recent posts, pulled live from Google Maps, Tripadvisor, Yelp, Instagram and TikTok. Tap any card to open it at the source.
      </p>

      {!research && loading ? <div className={`${styles.stripEmpty} mt-3`} role="status">Looking around {name}…</div> : null}
      {error ? <p className={`${styles.error} mt-3`} role="alert">{error} The idea cards above still work.</p> : null}

      {research && !research.configured ? (
        <div className={`${styles.stripEmpty} mt-3`}>Live research isn’t connected here yet. The idea cards above open real searches in the meantime.</div>
      ) : null}

      {research?.configured && current ? (
        <>
          <div className={styles.researchTabs} role="tablist" aria-label="Research sources">
            {tabs.map(({ id, label }) => {
              const count = research[id].status === 'ok' ? research[id].items.length : 0;
              return (
                <button key={id} type="button" role="tab" aria-selected={active === id} className={`${styles.segBtn} ${active === id ? styles.segOn : ''}`} onClick={() => setTab(id)}>
                  {label}
                  {count ? <span className={styles.researchCount}>{count}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-2" role="tabpanel">
            <SectionBody id={active} section={current as ResearchSection<unknown>} />
            <p className="mt-2 text-[11px] leading-4 text-ink-subtle">{footnote(active, current as ResearchSection<unknown>)}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
