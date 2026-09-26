'use client';

import { memberFetch } from '@/lib/platform/memberFetch';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { writeResearchCache } from '@/lib/designer/deviceData';
import { affiliateDisclosure, handoffNote, openTableSearch, takesTableSearch } from '@/lib/booking/partners';
import { safeResearch } from '@/lib/research/clientSafety';
import { PicksBasket } from './PicksBasket';
import styles from './designer.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';

/*
 * Research costs money (paid provider calls), so it never runs on a page
 * view: it runs when someone taps "Look around", or shows what this device
 * already fetched. Guests' copies and AI-handoff links open with no cache on
 * the device, so they wait for a tap too.
 *
 * The device keeps the place's listings per place (name + region) and the
 * fares per route and dates, so a new taste or new dates never re-runs the
 * whole lookup on their own.
 */
const LEGACY_PREFIX = 'dope.research.v1:';
const PLACE_PREFIX = 'dope.research.v2:place:';
const FARES_PREFIX = 'dope.research.v2:fares:';
const FRESH_MS = 6 * 60 * 60 * 1000;

type PlaceResearch = Omit<Research, 'flights'>;
type Stored<T> = { savedAt: string; value: T };

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

const fresh = (iso: unknown) => typeof iso === 'string' && Date.now() - Date.parse(iso) < FRESH_MS;

function readJson(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Writes through the shared helper, which keeps only the newest entries so a phone's storage can't fill up. */
function write(key: string, value: unknown) {
  // Storage full or blocked: the panel still works for this visit.
  writeResearchCache(key, value);
}

/** What this device already has: listings for the place, fares for the route and dates. */
function readCache(placeKey: string, faresKey: string | null, legacyKey: string): { place: PlaceResearch | null; fares: FlightSection | null } {
  const storedPlace = readJson(placeKey) as Stored<PlaceResearch> | null;
  const storedFares = faresKey ? (readJson(faresKey) as Stored<FlightSection> | null) : null;
  let place = storedPlace && fresh(storedPlace.savedAt) && storedPlace.value?.configured ? storedPlace.value : null;
  let fares = storedFares && fresh(storedFares.savedAt) ? storedFares.value : null;
  if (!place) {
    // Results saved before the per-place split still count on this device.
    const legacy = readJson(legacyKey) as Research | null;
    if (legacy?.configured && fresh(legacy.generatedAt) && legacy.topSpots) {
      const { flights, ...rest } = legacy;
      place = rest;
      fares ??= faresKey && flights?.status !== 'skipped' ? flights : null;
    }
  }
  return { place, fares };
}

function ago(iso: string | null | undefined): string {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function Photo({ src, alt, tall }: { src?: string; alt?: string; tall?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={`${styles.researchPhoto} ${tall ? styles.researchPhotoTall : ''} ${styles.researchPhotoEmpty}`} aria-hidden />;
  return (
    /* eslint-disable-next-line @next/next/no-img-element -- remote listing photos, shown as the provider serves them */
    <img className={`${styles.researchPhoto} ${tall ? styles.researchPhotoTall : ''}`} src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  );
}

/** A table request for restaurant tabs: the trip's first night, the whole party. */
type Reserve = { where: string; date: string; covers: number };

function SpotCard({ spot, reserve }: { spot: ResearchSpot; reserve?: Reserve }) {
  if (reserve && takesTableSearch(spot)) {
    return (
      <div className={styles.researchCard}>
        <a className={styles.researchMain} href={spot.url} target="_blank" rel="noopener noreferrer">
          <SpotBody spot={spot} />
        </a>
        <a
          className={styles.reserveLink}
          href={openTableSearch({ name: spot.name, where: reserve.where, date: reserve.date, covers: reserve.covers })}
          target="_blank"
          rel="noopener noreferrer"
          title={handoffNote('opentable')}
        >
          <SourceLogo source={'opentable'} size={14} className="mr-1.5" />Find a table on OpenTable ↗
        </a>
      </div>
    );
  }
  return (
    <a className={styles.researchCard} href={spot.url} target="_blank" rel="noopener noreferrer">
      <SpotBody spot={spot} />
    </a>
  );
}

function SpotBody({ spot }: { spot: ResearchSpot }) {
  return (
    <>
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
        <span className={styles.researchSource}><SourceLogo source={spot.source} size={14} className="mr-1.5" />{spot.source} ↗</span>
      </span>
    </>
  );
}

function PostCard({ post }: { post: ResearchPost }) {
  return (
    <a className={styles.researchCard} href={post.url} target="_blank" rel="noopener noreferrer">
      <Photo src={post.image?.url} alt={post.image?.alt} tall />
      <span className={styles.researchBody}>
        <span className={styles.researchMeta}>
          @{post.author} · posted {ago(post.publishedAt)}
          {post.views !== undefined ? ` · ${compact(post.views)} views` : ''}
        </span>
        <span className={styles.researchSnippet}>{post.caption}</span>
        <span className={styles.researchSource}>
          <SourceLogo source={post.platform} size={14} className="mr-1.5" />
          {post.platform}
          {post.location ? ` · ${post.location}` : ` · found for ${post.about}`} ↗
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
        <span className={styles.researchSource}><SourceLogo source={'google'} size={14} className="mr-1.5" />Google Events ↗</span>
      </span>
    </a>
  );
}

type Party = { adults: number; kids: number };

/** Fares are per adult; the qualifier and any party estimate sit above the cards, where they're read first. */
function Flights({ section, party }: { section: FlightSection; party: Party }) {
  const hours = (min: number) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
  const cheapest = section.items[0]?.price;
  const typical = section.typical;
  const versusTypical = (price: number) => (!typical ? null : price < typical[0] ? 'below the usual range' : price > typical[1] ? 'above the usual range' : 'in the usual range');
  return (
    <>
      <p className={styles.researchFareNote}>
        <strong>Each fare is for one adult, round trip, economy.</strong> Indicative prices from Google Flights, fetched {ago(section.fetchedAt)}. Fares move fast; confirm before you book.
      </p>
      {cheapest !== undefined && (party.adults > 1 || party.kids > 0) ? (
        <p className={styles.researchFareNote}>
          Rough estimate for your crew: about <strong>{money(cheapest * Math.max(party.adults, 1))}</strong> for {Math.max(party.adults, 1)} adult{Math.max(party.adults, 1) === 1 ? '' : 's'} at the cheapest fare shown.
          {party.kids > 0 ? ` Kids’ fares aren’t shown here, so this leaves out ${party.kids === 1 ? 'the 1 kid' : `the ${party.kids} kids`}.` : ''}
        </p>
      ) : null}
      {typical ? (
        <p className={styles.researchFareNote}>
          Google Flights says a round trip on this route usually costs {money(typical[0])}–{money(typical[1])} per adult for these dates. Below that is a good price; above it is pricier than usual.
        </p>
      ) : null}
      <div className={styles.stayGrid}>
        {section.items.map((flight) => {
          const range = versusTypical(flight.price);
          return (
            <a key={flight.id} className={styles.stayLink} href={section.link ?? 'https://www.google.com/travel/flights'} target="_blank" rel="noopener noreferrer">
              <span className={styles.stayName}>
                {money(flight.price)} <span className={styles.researchPer}>per adult · round trip</span>
              </span>
              <span className="text-[13px] text-ink">{flight.airlines.join(' + ') || 'Airline not listed'}</span>
              <span className="text-[12px] text-ink-muted">
                {flight.from} → {flight.to} · {flight.stops === 0 ? 'nonstop' : `${flight.stops} stop${flight.stops === 1 ? '' : 's'}`} · {hours(flight.durationMin)}
              </span>
              <span className="text-[11px] text-ink-subtle">Departs {flight.departs.replace(' ', ' at ')}{range ? ` · ${range}` : ''}</span>
            </a>
          );
        })}
      </div>
    </>
  );
}

function SectionBody({ id, section, party, reserve }: { id: TabId; section: ResearchSection<unknown>; party: Party; reserve?: Reserve }) {
  if (section.status !== 'ok') return <div className={styles.stripEmpty}>{section.note ?? 'Nothing here yet.'}</div>;
  if (id === 'flights') return <Flights section={section as FlightSection} party={party} />;
  return (
    <>
      {id === 'instagram' || id === 'tiktok' ? <p className={`tag ${styles.researchVet}`}>Recent public posts · not vetted</p> : null}
      <div className={styles.strip}>
        {id === 'instagram' || id === 'tiktok'
          ? (section.items as ResearchPost[]).map((post) => <PostCard key={post.id} post={post} />)
          : id === 'events'
            ? (section.items as ResearchEvent[]).map((event) => <EventCard key={event.id} event={event} />)
            : (section.items as ResearchSpot[]).map((spot) => <SpotCard key={spot.id} spot={spot} reserve={id === 'food' || id === 'yelp' ? reserve : undefined} />)}
      </div>
      {reserve && (id === 'food' || id === 'yelp') ? <p className="mt-2 text-[11px] leading-4 text-ink-subtle">{handoffNote('opentable')} Not every place is on OpenTable.{affiliateDisclosure() ? ` ${affiliateDisclosure()}` : ''}</p> : null}
    </>
  );
}

const eventsSearch = (place: string) => `https://www.google.com/search?q=${encodeURIComponent(`events in ${place}`)}&ibp=htl;events`;

/** Footnotes follow the section's status: no "listings are theirs" line under a section that has no listings. */
function footnote(id: TabId, section: ResearchSection<unknown>, place: string): ReactNode {
  const when = section.fetchedAt ? `, fetched ${ago(section.fetchedAt)}` : '';
  const eventsLink = (
    <a className="underline underline-offset-2" href={eventsSearch(place)} target="_blank" rel="noopener noreferrer">
      <SourceLogo source={'google'} size={13} className="mr-1" />Search Google for events in {place} ↗
    </a>
  );
  if (section.status === 'unavailable' || section.status === 'skipped') return id === 'events' ? eventsLink : null;
  if (section.status === 'empty') return id === 'events' ? <>Checked {section.source}{when}. {eventsLink}</> : `Checked ${section.source}${when}.`;
  if (id === 'flights') {
    const flights = section as FlightSection;
    return flights.route ? `${flights.route.from} ⇄ ${flights.route.to}, ${shortDate(flights.route.depart)} to ${shortDate(flights.route.return)}. From ${section.source}${when}.` : `From ${section.source}${when}.`;
  }
  if (id === 'hiddenGems') return `${section.note ?? ''} From ${section.source}${when}.`;
  if (id === 'instagram' || id === 'tiktok') {
    return `Public posts from ${section.source}${when}, not checked by us. We leave out ads, hotel promos and giveaways we can spot; “posted” is when it went up, and the photo can be older. Tap through to see each on ${section.source}.`;
  }
  return `From ${section.source}${when}. Listings and ratings are theirs; check hours and bookings with each place.`;
}

function Skeletons() {
  return (
    <div className={styles.strip} aria-hidden>
      {[0, 1, 2].map((index) => (
        <span key={index} className={styles.researchSkeleton}>
          <span className={styles.researchSkeletonPhoto} />
          <span className={styles.researchSkeletonLine} />
          <span className={`${styles.researchSkeletonLine} ${styles.researchSkeletonShort}`} />
        </span>
      ))}
    </div>
  );
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
  const placeKey = `${PLACE_PREFIX}${JSON.stringify([request.name, request.region ?? ''])}`;
  const faresKey = request.from ? `${FARES_PREFIX}${JSON.stringify([request.from, request.to, request.depart, request.nights])}` : null;
  const legacyKey = `${LEGACY_PREFIX}${JSON.stringify(request)}`;
  const cacheId = `${placeKey}|${faresKey ?? ''}`;
  const party = useMemo<Party>(() => ({
    adults: trip.participants.filter((person) => person.kind === 'adult').length,
    kids: trip.participants.filter((person) => person.kind === 'kid').length,
  }), [trip.participants]);

  const [place, setPlace] = useState<PlaceResearch | null>(null);
  const [fares, setFares] = useState<FlightSection | null>(null);
  const [readFor, setReadFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [tab, setTab] = useState<TabId | null>(null);

  // Show what this device already fetched for this place (the canvas renders only after hydration).
  if (readFor !== cacheId) {
    const cached = readCache(placeKey, faresKey, legacyKey);
    setReadFor(cacheId);
    setPlace(cached.place ? safeResearch(cached.place) : null);
    setFares(cached.fares);
    setError('');
    setStatus('');
  }

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function run(kind: 'first' | 'refresh' | 'fares') {
    if (loading) return;
    setLoading(true);
    setElapsed(0);
    setError('');
    setStatus('');
    try {
      const response = await memberFetch('/api/designer/research', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      const body = (await response.json().catch(() => ({}))) as Research | { error?: string | { message?: string } };
      if (!response.ok || !('topSpots' in body)) {
        const message = 'error' in body ? (typeof body.error === 'string' ? body.error : body.error?.message) : undefined;
        throw new Error(message || 'Research is unavailable right now.');
      }
      const { flights, ...rest } = body;
      if (kind !== 'first' && place?.configured) {
        // The server answers repeats from its cache; say so instead of implying a new fetch.
        const sameListings = rest.topSpots.fetchedAt !== null && rest.topSpots.fetchedAt === place.topSpots.fetchedAt;
        const sameFares = !fares || flights.fetchedAt === fares.fetchedAt;
        const cachedFlag = (body as { cached?: unknown }).cached === true;
        const unchanged = cachedFlag || body.spentUsd === 0 || (sameListings && sameFares);
        const fetchedAt = rest.topSpots.fetchedAt ?? flights.fetchedAt ?? body.generatedAt;
        setStatus(kind === 'fares'
          ? flights.status === 'ok' ? 'Fares loaded.' : ''
          : unchanged ? `Already up to date (fetched ${ago(fetchedAt)}).` : 'Updated just now.');
      }
      setPlace(safeResearch(rest));
      setFares(request.from ? flights : null);
      // Only real listings are kept on the device; a cap or outage must not stick for 6 hours (review S3).
      if (body.configured && rest.topSpots.status === 'ok') {
        write(placeKey, { savedAt: new Date().toISOString(), value: rest } satisfies Stored<PlaceResearch>);
      }
      if (body.configured) {
        if (faresKey && (flights.status === 'ok' || flights.status === 'empty')) write(faresKey, { savedAt: new Date().toISOString(), value: flights } satisfies Stored<FlightSection>);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Research is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }

  const flightsSection: FlightSection | null = !request.from
    ? { status: 'skipped', source: 'Google Flights', fetchedAt: null, note: 'Add a home city with a known airport to see real fares.', items: [] }
    : fares;
  const sectionFor = (id: TabId): ResearchSection<unknown> | null => (!place ? null : id === 'flights' ? flightsSection : place[id]);
  const tabs = place ? TABS.filter(({ id }) => id === 'flights' || sectionFor(id)?.status !== 'skipped') : [];
  const active: TabId = tab ?? tabs.find(({ id }) => sectionFor(id)?.status === 'ok')?.id ?? 'topSpots';
  const current = sectionFor(active);
  const note = current ? footnote(active, current, name) : null;

  return (
    <section className={styles.panel} aria-labelledby="research-title" aria-busy={loading}>
      <div className={styles.researchHead}>
        <h2 id="research-title" className={styles.factTitle}>
          What’s good in {name}
        </h2>
        {loading ? (
          <span className={`tag ${styles.researchChip}`} role={place ? 'status' : undefined}>
            <span className={styles.researchDot} aria-hidden />
            {place ? 'Refreshing…' : `Looking… ${elapsed}s`}
          </span>
        ) : place?.configured ? (
          <button type="button" className={styles.miniBtn} onClick={() => void run('refresh')}>
            Refresh
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-[13px] leading-5 text-ink-muted">
        Real places and recent posts from Google Maps, Tripadvisor, Yelp, Instagram and TikTok{request.from ? ', plus fares from Google Flights' : ''}. Tap any card to open it at the source.
      </p>
      {status ? <p className={`${styles.researchStatus} mt-2`} role="status">{status}</p> : null}

      {!place && !loading ? (
        <div className={styles.researchStart}>
          <p className="text-[13px] leading-5 text-ink-soft">
            Nothing runs until you ask. A live look takes about 15 seconds.
          </p>
          <button type="button" className={styles.ghost} onClick={() => void run('first')}>
            Look around {name}
          </button>
        </div>
      ) : null}

      {!place && loading ? (
        <div className="mt-3">
          <p className={styles.researchStatus} role="status">
            Looking around {name}… {elapsed < 20 ? 'about 15 seconds' : 'still going; a few sources are slow'}.
          </p>
          <Skeletons />
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className={styles.error} role="alert">{error} The idea cards below still work.</p>
          <button type="button" className={styles.miniBtn} onClick={() => void run(place ? 'refresh' : 'first')} disabled={loading}>
            Try again
          </button>
        </div>
      ) : null}

      {place && !place.configured ? (
        <p className="notice mt-3">Live research isn’t connected here yet. The idea cards below open real searches in the meantime.</p>
      ) : null}

      {place?.configured ? (
        <>
          <div className={styles.researchTabs} role="tablist" aria-label="Research sources">
            {tabs.map(({ id, label }) => {
              const section = sectionFor(id);
              const count = section?.status === 'ok' ? section.items.length : 0;
              return (
                <button key={id} type="button" role="tab" aria-selected={active === id} className={`${styles.segBtn} ${active === id ? styles.segOn : ''}`} onClick={() => setTab(id)}>
                  <SourceLogo source={label} size={13} className="mr-1" />
                  {label}
                  {count ? <span className={styles.researchCount}>{count}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="mt-2" role="tabpanel">
            {current ? (
              <>
                <SectionBody id={active} section={current} party={party} reserve={{ where: name, date: trip.startDate, covers: party.adults + party.kids }} />
                {note ? <p className="mt-2 text-[11px] leading-4 text-ink-subtle">{note}</p> : null}
              </>
            ) : (
              <div className={styles.researchStart}>
                <p className="text-[13px] leading-5 text-ink-soft">
                  Fares for {request.from} ⇄ {request.to} on these dates aren’t loaded on this device yet.
                </p>
                <button type="button" className={styles.miniBtn} onClick={() => void run('fares')} disabled={loading}>
                  {loading ? 'Checking…' : 'Check fares'}
                </button>
              </div>
            )}
          </div>
          {place ? <PicksBasket trip={trip} research={place} placeName={name} /> : null}
        </>
      ) : null}
    </section>
  );
}
