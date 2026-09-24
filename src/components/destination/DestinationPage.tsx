'use client';

import Link from 'next/link';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, Panel, cn, formatDateRange } from '@/components/ui';
import { FixtureBanner, OpportunityCardView, ProvenanceNote } from '@/components/shell';
import { EVENTS, EVENT_INDEX } from '@/lib/data/events';
import { getDestinationBySlug, type DestinationPulse } from '@/lib/pulse';
import { ResearchPulse } from '@/components/research/ResearchPulse';
import type { WorldEvent } from '@/lib/types';
import { listInspiration, INSPIRATION_FIXTURE_DISCLOSURE, INSPIRATION_KIND_LABEL } from '@/lib/inspiration';
import { listOpportunities, ACCESS_FIXTURE_DISCLOSURE } from '@/lib/access';
import { listTravelersForDestination, TRAVELER_FIXTURE_DISCLOSURE } from '@/lib/travelers';
import { listTripRoomsForDestination } from '@/lib/trips';
import { track } from '@/lib/analytics';
import { todayISO } from '@/lib/buzz/dates';
import { DistanceFromCity } from './DistanceFromCity';
import { Avatar } from '@/components/social';
import { PlaceGallery } from '@/components/place-media/PlaceGallery';
import { VenueMap } from '@/components/panels/VenueMap';
import { useIntentStore } from '@/lib/intent';
import { curatedPhotoForEvent, photoArchiveLabel } from '@/lib/place-media/curated';
import { curatedPhotosForDestination, type DestinationPhoto } from '@/lib/place-media/destinations';
import type { PlacePhoto } from '@/lib/place-media/media';
import type { InspirationItem } from '@/lib/inspiration';
import styles from './destination-page.module.css';

const TABS = ['pulse', 'happening', 'people', 'inspiration', 'access'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  pulse: 'Pulse',
  happening: 'Happening',
  people: 'People',
  inspiration: 'Inspiration',
  access: 'Stay / Access',
};

export function DestinationPage({ slug, focusEventId = '' }: { slug: string; focusEventId?: string }) {
  const [tab, setTab] = useState<Tab>('pulse');
  const pulse = useMemo(
    () => getDestinationBySlug(EVENTS, slug, todayISO()),
    [slug],
  );

  useEffect(() => {
    if (pulse) track('destination_opened', { slug: pulse.slug });
  }, [pulse]);

  if (!pulse) {
    return (
      <main className="px-4 py-16 sm:px-8">
        <EmptyState
          title="That destination is not on the calendar."
          body="dope.travel destinations are built from curated occasions. Search for a city that is actually on the board."
          action={
            <Link href="/" className="btn btn-ghost">
              Return to World
            </Link>
          }
        />
      </main>
    );
  }

  return <DestinationLoaded pulse={pulse} tab={tab} onTab={setTab} focusEventId={focusEventId} />;
}

function DestinationActions({ event, planningHref, destination }: {
  event?: WorldEvent;
  planningHref: string;
  destination: string;
}) {
  const items = useIntentStore((state) => state.items);
  const toggle = useIntentStore((state) => state.toggle);
  if (!event) return <Link href={planningHref} className="btn btn-ghost mt-6">Explore planning for {destination} ↗</Link>;

  const saved = items.some((item) => item.verb === 'save' && item.kind === 'event' && item.id === event.id);
  const watched = items.some((item) => item.verb === 'watch' && item.kind === 'event' && item.id === event.id);
  const intent = (verb: 'save' | 'watch') => toggle({
    verb, kind: 'event', id: event.id, label: event.name, href: `/?event=${encodeURIComponent(event.id)}`,
  });
  return <div className="mt-6">
    <div className="flex flex-wrap gap-2">
      <button type="button" aria-pressed={saved} onClick={() => intent('save')} className="btn btn-ghost">{saved ? 'Saved ✓' : 'Save this event'}</button>
      <button type="button" aria-pressed={watched} onClick={() => intent('watch')} className="btn btn-ghost">{watched ? 'Watching ✓' : 'Watch this event'}</button>
      <Link href={planningHref} className="btn btn-ghost h-auto min-h-11 whitespace-normal py-2.5 text-left">Plan around {event.name} ↗</Link>
    </div>
    <p className="mt-3 text-[12px] leading-5 text-ink-subtle">Save and Watch stay on this device. Watch does not send notifications.</p>
  </div>;
}

function PhotoCredit({ photo, className = '' }: { photo: PlacePhoto; className?: string }) {
  return <a
    className={`${styles.photoCredit} ${className}`}
    href={photo.sourceUrl}
    target="_blank"
    rel="noopener noreferrer"
    title={`${photo.title} · ${photo.credit} · ${photo.license}`}
  >
    {photoArchiveLabel(photo)} · {photo.credit} · {photo.license} ↗
  </a>;
}

function PhotoTile({ photo, city, large = false }: { photo: DestinationPhoto; city: string; large?: boolean }) {
  return <figure className={large ? styles.mainPhoto : styles.sidePhoto}>
    {/* Local editorial archive images are deliberately served without third-party image requests. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className={styles.photoImage} src={photo.imageUrl} alt={`${city}: ${photo.title}`} loading={large ? 'eager' : 'lazy'} />
    <div className={styles.photoShade} aria-hidden="true" />
    {!large && <figcaption className={styles.sideCaption}>
      <span className={`eyebrow ${styles.photoEyebrow}`}>{photo.theme === 'experience' ? 'The experience' : photo.theme === 'town' ? 'Around town' : 'The setting'}</span>
      <span className={styles.sideTitle}>{photo.caption}</span>
      <PhotoCredit photo={photo} />
    </figcaption>}
  </figure>;
}

type EditorialCard = { id: string; eyebrow: string; title: string; copy: string; source: 'sample' | 'calendar'; href?: string };

function calendarTheme(reason: string): string {
  if (/airport|altiport|landing|transfer|flight|customs/i.test(reason)) return 'Getting there';
  if (/restaurant|dining|table|lunch|chef|Michelin|wine/i.test(reason)) return 'At the table';
  if (/hotel|chalet|stay|suite|staff/i.test(reason)) return 'Where to stay';
  if (/ski|piste|lift|mountain|terrain|slope|gondola|powder/i.test(reason)) return 'On the mountain';
  return 'The local scene';
}

function destinationEdit(inspiration: InspirationItem[], event?: WorldEvent): EditorialCard[] {
  const kinds = ['experience', 'restaurant', 'bar', 'nightlife', 'place', 'stay'] as const;
  const picks = kinds.flatMap((kind) => inspiration.find((item) => item.kind === kind) ?? []).slice(0, 3);
  const cards: EditorialCard[] = picks.map((item) => ({
    id: item.id,
    eyebrow: item.category,
    title: item.title,
    copy: item.subtitle ?? item.note ?? 'An idea for your trip board.',
    source: 'sample',
    href: item.canonicalUrl,
  }));
  for (const [index, reason] of (event?.whyGo ?? []).entries()) {
    if (cards.length >= 3) break;
    cards.push({
      id: `${event!.id}-reason-${index}`,
      eyebrow: calendarTheme(reason),
      title: reason,
      copy: event!.name,
      source: 'calendar',
    });
  }
  return cards;
}

function DestinationLoaded({
  pulse,
  tab,
  onTab,
  focusEventId,
}: {
  pulse: DestinationPulse;
  tab: Tab;
  onTab: (tab: Tab) => void;
  focusEventId: string;
}) {
  // Samples and live partner inventory never share a screen.
  const platformConnected = Boolean(usePlatformAuth().client);
  const events = pulse.eventIds
    .map((id) => EVENT_INDEX.get(id))
    .filter((event): event is NonNullable<typeof event> => Boolean(event));
  const inspiration = listInspiration(pulse.id);
  const offers = listOpportunities(pulse.id);
  const people = listTravelersForDestination(pulse.id);
  const rooms = listTripRoomsForDestination(pulse.id);
  const today = todayISO();
  // The occasion the traveler arrived from leads; otherwise the next one on the calendar.
  const focusEvent = events.find((event) => event.id === focusEventId && event.end >= today);
  const nextEvent = focusEvent ?? [...events]
    .filter((event) => event.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const skiOccasion = nextEvent && (nextEvent.category === 'ski' || nextEvent.secondaryCategories?.includes('ski'));
  const planningHref = nextEvent
    ? skiOccasion
      ? `/trips?season=winter&interest=ski&event=${encodeURIComponent(nextEvent.id)}#family-ski`
      : `/circles?destination=${encodeURIComponent(pulse.slug)}&event=${encodeURIComponent(nextEvent.id)}`
    : `/circles?destination=${encodeURIComponent(pulse.slug)}`;
  const destinationPhotos = curatedPhotosForDestination(pulse.slug);
  const eventPhotos = events.flatMap((event) => curatedPhotoForEvent(event.id) ?? []);
  const eventPhoto = curatedPhotoForEvent(nextEvent?.id ?? '')
    ?? eventPhotos.find((photo) => photo.subject === 'place')
    ?? eventPhotos[0];
  const leadPhoto = destinationPhotos[0]
    ?? (eventPhoto ? { ...eventPhoto, caption: pulse.name, theme: 'landscape' as const } : null);
  const supportingPhotos = destinationPhotos.filter((photo) => photo.sourceUrl !== leadPhoto?.sourceUrl).slice(0, 2);
  const edit = destinationEdit(inspiration, nextEvent ?? events[0]);

  return (
    <main className="px-4 pb-32 pt-5 sm:px-8">
      <div className={styles.breadcrumb}>
        <Link href="/">The world</Link><span aria-hidden="true">/</span><span>{pulse.country}</span><span aria-hidden="true">/</span><span>{pulse.name}</span>
        <span className={`eyebrow ${styles.breadcrumbIndex}`}>dope.travel DESTINATION FILE</span>
      </div>

      <section className={cn(styles.hero, !supportingPhotos.length && styles.heroSolo)} aria-label={`Discover ${pulse.name}`}>
        <div className={styles.heroMain}>
          {leadPhoto
            ? <PhotoTile photo={leadPhoto} city={pulse.name} large />
            : <div className={styles.noPhoto}><PlaceGallery event={events[0]!} /></div>}
          <div className={styles.heroCopy}>
            <div className={`eyebrow ${styles.heroTopline}`}><span className={styles.star} aria-hidden="true">✳</span> A PLACE WORTH THE JOURNEY <span className={`horizon-band ${styles.heroToplineRule}`} /></div>
            <div className={styles.heroBottom}>
              <p className={`eyebrow ${styles.heroCountry}`}>{pulse.country} <span aria-hidden="true">·</span> {pulse.archetypes.slice(0, 2).join(' / ')}</p>
              <h1>{pulse.name}</h1>
              <p className={styles.heroTagline}>{nextEvent?.tagline ?? 'Find your next reason to go.'}</p>
              <div className={styles.heroActions}>
                <Link href={planningHref} className={`btn btn-primary ${styles.primaryAction}`}>Start a trip <span aria-hidden="true">↗</span></Link>
                <a href="#destination-edit" className={`btn btn-ghost ${styles.secondaryAction}`}>Get a feel for it <span aria-hidden="true">↓</span></a>
              </div>
              {leadPhoto && <PhotoCredit photo={leadPhoto} className={styles.mainCredit} />}
            </div>
          </div>
        </div>
        {supportingPhotos.length > 0 && <div className={cn(styles.heroSide, supportingPhotos.length === 1 && styles.heroSideSingle)}>
          {supportingPhotos.map((photo) => <PhotoTile key={photo.sourceUrl} photo={photo} city={pulse.name} />)}
        </div>}
      </section>
      {supportingPhotos.length > 0 && <div className={styles.mobileCredits} aria-label="Photo credits">
        {supportingPhotos.map((photo) => <PhotoCredit key={photo.sourceUrl} photo={photo} />)}
      </div>}

      <div className={`surface-well ${styles.factBar}`}>
        <div><span className={`eyebrow ${styles.factLabel}`}>Next occasion</span><strong>{nextEvent ? nextEvent.name : 'Explore the calendar'}</strong></div>
        <div><span className={`eyebrow ${styles.factLabel}`}>When to go</span><strong>{nextEvent ? formatDateRange(nextEvent.start, nextEvent.end) : 'Dates to be announced'}</strong></div>
        <div><span className={`eyebrow ${styles.factLabel}`}>The edit</span><strong>{events.length} curated {events.length === 1 ? 'occasion' : 'occasions'} · {pulse.archetypes[0] ?? 'travel'}</strong></div>
        <DistanceFromCity target={pulse.coords} labelClassName={`eyebrow ${styles.factLabel}`} linkClassName={styles.distanceLink} />
        <a href="#destination-map" className="btn btn-ghost btn-sm">Explore the map <span aria-hidden="true">↗</span></a>
      </div>

      <div className={styles.belowHero}>
        <section id="destination-edit" className={styles.edit} aria-labelledby="destination-edit-title">
          <div className={styles.editHeader}>
            <div><p className={`eyebrow ${styles.sectionKicker}`}><span aria-hidden="true">✳</span> THE DESTINATION EDIT</p><h2 id="destination-edit-title">The days you came for.</h2></div>
            <p>Mountains, tables, streets, and little detours. Start with a feeling, then make a plan.</p>
          </div>
          <div className={styles.editGrid}>
            {edit.map((card, index) => <article className={`surface ${styles.editCard}`} key={card.id}>
              <div className={`eyebrow ${styles.cardTop}`}><span><span className={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</span>{card.eyebrow}</span><span aria-hidden="true">✳</span></div>
              <div className={styles.cardBody}>
                <h3>{card.title}</h3>
                <p>{card.copy}</p>
              </div>
              <div className={styles.cardFoot}><span className="tag">{card.source === 'sample' ? 'Sample editorial pick' : 'Curated calendar note'}</span>{card.href && <a href={card.href} target="_blank" rel="noopener noreferrer">Source ↗</a>}</div>
            </article>)}
          </div>
          <p className={styles.editDisclosure}>{edit.some((card) => card.source === 'sample')
            ? 'Sample editorial picks are ideas for the trip board, not live recommendations or bookings. Check venues and conditions before you go.'
            : 'These are notes from the curated calendar, not live conditions or availability. Check current details before you go.'}</p>
          {inspiration.length > 0
            ? <button type="button" className={`btn btn-ghost ${styles.allIdeas}`} onClick={() => { onTab('inspiration'); document.getElementById('destination-tabs')?.scrollIntoView(); }}>See the full inspiration board <span aria-hidden="true">↗</span></button>
            : <button type="button" className={`btn btn-ghost ${styles.allIdeas}`} onClick={() => { onTab('happening'); document.getElementById('destination-tabs')?.scrollIntoView(); }}>See what is happening <span aria-hidden="true">↗</span></button>}
          {nextEvent?.description && <div className={styles.insideLine}>
            <span className={`horizon-band ${styles.horizonBand}`} aria-hidden="true" />
            <p className={`eyebrow ${styles.sectionKicker}`}>The inside line <span aria-hidden="true">/</span> Curated calendar</p>
            <p>{nextEvent.description}</p>
          </div>}
        </section>

        <aside className={`surface ${styles.moment}`}>
          <div className={`eyebrow ${styles.momentHeader}`}><span>01 / THE MOMENT</span><span aria-hidden="true">✦</span></div>
          <p className={`eyebrow ${styles.momentKicker}`}>Next on the calendar</p>
          {nextEvent ? <>
            <h2>{nextEvent.name}</h2>
            <p className={styles.momentDate}>{formatDateRange(nextEvent.start, nextEvent.end)}</p>
            <p className={styles.momentSummary}>{nextEvent.tagline}</p>
            <DestinationActions event={nextEvent} planningHref={planningHref} destination={pulse.name} />
          </> : <p className={styles.momentSummary}>No future occasion is listed for this destination yet.</p>}
          <div id="destination-map" className={styles.mapPanel}>
            <p className={`eyebrow ${styles.momentKicker}`}>Find your way around</p>
            {events[0] && <VenueMap key={events[0].id} event={events[0]} compact />}
          </div>
          <p className={styles.calendarNote}>Occasion dates come from the curated calendar. Confirm details with the organizer before making plans.</p>
        </aside>
      </div>

      <div id="destination-tabs" className={`surface-well ${styles.tabs}`} role="tablist" aria-label="Destination sections">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={styles.tab}
            onClick={() => onTab(item)}
          >
            {TAB_LABEL[item]}
          </button>
        ))}
      </div>

      <section className="mt-8">
        {tab === 'pulse' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Why now" accent>
              <ol className="flex flex-col gap-4">
                {pulse.reasons.map((reason) => (
                  <li key={reason.id}>
                    <p className="text-[14px] text-ink">{reason.text}</p>
                    <ProvenanceNote className="mt-1" kind={reason.provenance} />
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel title="Signals">
              <dl className="grid gap-4">
                {Object.entries(pulse.signals).map(([key, fact]) =>
                  fact ? (
                    <div key={key} className="flex items-start justify-between gap-4">
                      <div>
                        <dt className="label-sm text-ink-muted">{fact.label}</dt>
                        <dd className="mt-1 text-[13px] text-ink-muted">{fact.note}</dd>
                        <ProvenanceNote className="mt-1" kind={fact.provenance} />
                      </div>
                      <p className="tabular text-right text-[18px] text-ink">
                        {fact.displayValue ?? (
                          <>
                            {Math.round(fact.value)}
                            <span className="text-[11px] text-ink-muted">/100</span>
                          </>
                        )}
                      </p>
                    </div>
                  ) : null,
                )}
              </dl>
            </Panel>
            <div className="lg:col-span-2"><ResearchPulse destinationSlug={pulse.slug} /></div>
          </div>
        )}

        {tab === 'happening' && (
          <div className="grid gap-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="surface flex flex-col gap-2 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="eyebrow">{event.category}</p>
                  <Link href={`/?event=${event.id}`} className="font-display text-[22px] text-ink hover:text-brass">{event.name}</Link>
                  <p className="text-[13px] text-ink-muted">{event.tagline}</p>
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  <p className="tabular text-[12px] text-ink-muted">{formatDateRange(event.start, event.end)}</p>
                  <Link href={`/circles?destination=${encodeURIComponent(pulse.slug)}&event=${encodeURIComponent(event.id)}`} className="btn btn-ghost btn-sm">Plan around this event ↗</Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'people' && (
          <div className={`grid gap-4 ${styles.tabBody}`}>
            <FixtureBanner>{TRAVELER_FIXTURE_DISCLOSURE}</FixtureBanner>
            <EmptyState
              title="No live travelers are listed here."
              body="Public member interest is private by default. Editorial portraits below are layout examples only."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((portrait) => (
                <Link
                  key={portrait.person.handle}
                  href={`/people/${portrait.person.handle}`}
                  className="surface flex items-center gap-3 p-4"
                >
                  <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={44} />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] text-ink">{portrait.person.displayName}</p>
                    <p className="truncate text-[12px] text-ink-muted">
                      @{portrait.person.handle} · {portrait.featuredModes[0]}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            {rooms.length > 0 && (
              <Panel title="Sample trip rooms">
                {rooms.map((room) => (
                  <Link key={room.id} href={`/circles/${room.id}`} className="flex min-h-11 items-center text-[14px] text-brass-bright underline decoration-brass/50 underline-offset-4 hover:text-bone">
                    {room.name} →
                  </Link>
                ))}
              </Panel>
            )}
          </div>
        )}

        {tab === 'inspiration' && (
          <div className={`grid gap-4 ${styles.tabBody}`}>
            <FixtureBanner>{INSPIRATION_FIXTURE_DISCLOSURE}</FixtureBanner>
            <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
              {inspiration.map((item) => (
                <article key={item.id} className="surface mb-3 break-inside-avoid p-5">
                  <p className="eyebrow">{INSPIRATION_KIND_LABEL[item.kind]}</p>
                  <h3 className="mt-2 font-display text-[22px] text-ink">{item.title}</h3>
                  {item.subtitle && <p className="mt-1 text-[13px] text-ink-muted">{item.subtitle}</p>}
                  {item.note && <p className="mt-3 text-[13px] leading-5 text-ink-soft">{item.note}</p>}
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-[12px] text-ink-muted">
                    <span className="tag">Sample editorial pick</span>
                    {item.canonicalUrl && <a href={item.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-brass-bright hover:text-bone">Original source ↗</a>}
                  </div>
                </article>
              ))}
            </div>
            {inspiration.length === 0 && (
              <EmptyState title="No editorial board for this place yet." body="Start a Circle to collect restaurants, stays and notes." />
            )}
          </div>
        )}

        {tab === 'access' && platformConnected && (
          <EmptyState
            title={`Partner offers for ${pulse.name} live in ACCESS.`}
            body="Samples are hidden once partner offers are connected, so they never sit beside real ones."
            action={<Link href={`/access?destination=${encodeURIComponent(pulse.slug)}`} className="btn btn-ghost">See partner offers ↗</Link>}
          />
        )}
        {tab === 'access' && !platformConnected && (
          <div className={`grid gap-4 ${styles.tabBody}`}>
            <FixtureBanner>{ACCESS_FIXTURE_DISCLOSURE}</FixtureBanner>
            <div className={`grid gap-4 lg:grid-cols-2 ${styles.offerCards}`}>
              {offers.map((offer) => (
                <OpportunityCardView key={offer.id} offer={offer} />
              ))}
            </div>
            {offers.length === 0 && (
              <EmptyState
                title="No partner opportunities mapped here yet."
                body="ACCESS stays inquiry-first. When a provider publishes against this destination, it will appear here."
              />
            )}
          </div>
        )}
      </section>

      <div className="sticky bottom-24 z-20 mt-10 flex justify-end md:bottom-6">
        <Link
          href={planningHref}
          className={`btn btn-ghost ${styles.stickyPlan}`}
        >
          {nextEvent ? `Plan ${nextEvent.name}` : 'Explore trip planning'}
        </Link>
      </div>
    </main>
  );
}
