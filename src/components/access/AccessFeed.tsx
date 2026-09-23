'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OpportunityCardView } from '@/components/shell';
import {
  ACCESS_FIXTURE_DISCLOSURE,
  OPPORTUNITY_KIND_LABEL,
  OPPORTUNITY_KINDS,
  SAMPLE_OFFER_NOTE,
  getOpportunity,
  listOpportunities,
  offerWindowLabel,
  type OpportunityCard,
  type OpportunityKind,
} from '@/lib/access';
import { track } from '@/lib/analytics';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  OFFER_PRICE_QUALIFIER,
  PARTNER_OFFER_KIND_LABEL,
  fetchPublishedOffers,
  offerAvailabilityLabel,
  type PublishedOffer,
} from '@/lib/platform/offers';
import styles from './access.module.css';

const OFFER_PHOTOS: Record<string, { className: string; description: string; context: string; author: string; source: string; license: string; licenseHref: string }> = {
  'opp-aspen-nell': {
    className: styles.aspenStayScene, description: 'Silver Queen Gondola above a snowy Aspen Mountain run', context: 'Aspen place archive',
    author: 'Wolfgang Moroder', source: 'https://commons.wikimedia.org/wiki/File:Aspen_Mountain_Silver_Queen_Gondola_over_Silver_dip_run.jpg',
    license: 'CC BY-SA 3.0', licenseHref: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  'opp-ase-kase': {
    className: styles.aspenAviationScene, description: 'Private aircraft on the apron at Aspen airport in October 2025', context: 'Aspen airport archive',
    author: 'Jeffrey Beall', source: 'https://commons.wikimedia.org/wiki/File:Planes_on_the_apron_at_Aspen_Airport_in_October_2025.JPG',
    license: 'CC BY 4.0', licenseHref: 'https://creativecommons.org/licenses/by/4.0/',
  },
  'opp-aspen-ground': {
    className: styles.aspenGroundScene, description: 'Snow-covered Main Street in Aspen', context: 'Aspen winter archive',
    author: 'Werdna', source: 'https://commons.wikimedia.org/wiki/File:Main_Street_in_Aspen.jpg',
    license: 'CC BY-SA 4.0', licenseHref: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'opp-monaco-harbor': {
    className: styles.monacoYachtScene, description: 'Yachts in Port Hercule, Monaco', context: 'Monaco place archive',
    author: 'Charles from Port Chester', source: 'https://commons.wikimedia.org/wiki/File:View_of_luxury_yachts_on_Port_Hercules_from_Avenue_de_la_Porte_Neuve,_Monaco_(53969150376).jpg',
    license: 'CC BY 2.0', licenseHref: 'https://creativecommons.org/licenses/by/2.0/',
  },
  'opp-courchevel-chalet': {
    className: styles.courchevelScene, description: 'Snowy ski pistes seen from Courchevel 1850', context: 'Courchevel place archive',
    author: 'Florian Pépellin', source: 'https://commons.wikimedia.org/wiki/File:Pistes_de_ski_c%C3%B4t%C3%A9_Loze_vues_de_Courchevel_1850_(d%C3%A9cembre_2019).JPG',
    license: 'CC BY-SA 4.0', licenseHref: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
};

function OfferScene({ offer }: { offer: OpportunityCard }) {
  const photo = OFFER_PHOTOS[offer.id];
  return (
    <div className={`${styles.offerScene} ${photo?.className ?? ''}`} role="group" aria-label={photo ? `${photo.description}; archive photography, not the pictured offer` : `${offer.destinationLabel} preview offer`}>
      <span className={styles.scenePlace}>{offer.destinationLabel}</span>
      <span className={styles.sceneLabel}>{photo?.context ?? 'Preview offer'}</span>
      {photo && <span className={styles.photoCredit}>Photo, display crop: <a href={photo.source} target="_blank" rel="noreferrer">{photo.author} ↗</a> · <a href={photo.licenseHref} target="_blank" rel="noreferrer">{photo.license}</a></span>}
    </div>
  );
}

export function AccessFeed() {
  const { client } = usePlatformAuth();
  return client ? <PartnerAccess client={client} /> : <SampleAccess />;
}

function AccessHero({ note }: { note: string }) {
  return (
    <section className={styles.hero} aria-labelledby="access-title">
      <div className={styles.heroImage} role="img" aria-label="Yachts in Port Hercule, Monaco, photographed in 2021" />
      <div className={styles.heroShade} />
      <span className={styles.heroCredit}>Photo, display crop: <a href="https://commons.wikimedia.org/wiki/File:Monaco_Port_Hercule_17.jpg" target="_blank" rel="noreferrer">Zairon ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></span>
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>dope.travel / ACCESS</p>
        <h1 id="access-title">Make the trip <em>happen.</em></h1>
        <p>Explore stays, arrivals and moments around the trip. Start with a possibility; the provider confirms every detail.</p>
        <a className={styles.heroAction} href="#opportunities">Explore opportunities <span aria-hidden="true">↘</span></a>
        <span className={styles.heroNote}>{note}</span>
      </div>
    </section>
  );
}

/** Live partner offers. Shown instead of samples whenever the platform is connected. */
function PartnerAccess({ client }: { client: NonNullable<ReturnType<typeof usePlatformAuth>['client']> }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; offers: PublishedOffer[] }>({ status: 'loading', offers: [] });
  const params = useSearchParams();
  const destination = params.get('destination');
  const staleSample = params.get('offer');

  useEffect(() => {
    let active = true;
    void fetchPublishedOffers(client).then(({ offers, error }) => {
      if (active) setState({ status: error ? 'error' : 'ready', offers });
    });
    return () => {
      active = false;
    };
  }, [client]);

  const needle = destination?.replace(/-/g, ' ').toLowerCase();
  const offers = needle
    ? [...state.offers].sort((a, b) =>
        Number(b.destination.toLowerCase().includes(needle)) - Number(a.destination.toLowerCase().includes(needle)))
    : state.offers;

  return (
    <main className={styles.page}>
      <AccessHero note="Offers from reviewed partners · inquiries, not bookings" />
      <div className={styles.content}>
        {staleSample && (
          <p className={styles.empty} role="status">
            That link pointed to a sample from the product preview. Samples are not shown now that partner offers are connected; here are the real ones.
          </p>
        )}
        <p className={styles.disclosure}>
          Offers here come from reviewed travel partners. Asking about one sends an inquiry, not a booking: the provider confirms dates, price and terms when they reply.
        </p>
        <section id="opportunities" className={styles.listing} aria-labelledby="opportunities-title">
          <div className={styles.listingHeader}>
            <div><p className={styles.eyebrow}>FROM OUR PARTNERS</p><h2 id="opportunities-title">Find your way in.</h2></div>
          </div>
          {state.status === 'loading' ? (
            <p className={styles.empty} role="status">Loading partner offers…</p>
          ) : state.status === 'error' ? (
            <p className={styles.empty} role="status">Partner offers could not be loaded just now. Nothing has been sent or held. Try again in a moment.</p>
          ) : offers.length === 0 ? (
            <p className={styles.empty}>No partner offers are published yet. dope.travel does not invent availability while we wait.</p>
          ) : (
            <div className={styles.offerGrid}>
              {offers.map((offer) => (
                <article key={offer.id} className={`${styles.offerFrame} glass flex flex-col gap-3 p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="label-sm text-brass">{PARTNER_OFFER_KIND_LABEL[offer.kind]} · {offer.destination}</span>
                    <span className="label-sm text-ink-muted">{offerAvailabilityLabel(offer)}</span>
                  </div>
                  <h3 className="font-display text-[22px] leading-tight text-ink">{offer.title}</h3>
                  <p className="text-[13px] leading-5 text-ink-muted">{offer.description}</p>
                  <p className="text-[12px] text-ink">Verified partner: {offer.provider_name}</p>
                  <div>
                    <p className="text-[13px] text-ink">{offer.price_label || 'Ask the provider for a quote'}</p>
                    <p className="text-[11px] text-ink-muted">{OFFER_PRICE_QUALIFIER}</p>
                  </div>
                  <Link className={styles.askLink} href={`/community?tab=offers&offer=${encodeURIComponent(offer.id)}`}>
                    Ask {offer.provider_name} <span aria-hidden="true">↗</span>
                  </Link>
                  <p className="text-[10px] leading-4 text-ink-faint">This sends a request, not a booking. Offer ends {new Date(offer.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
                </article>
              ))}
            </div>
          )}
        </section>
        <p className={styles.partnerNote}>Are you a travel provider? <Link href="/partners">Explore the partner studio ↗</Link></p>
      </div>
    </main>
  );
}

/** Sample opportunities for the unconnected preview. Every card says so. */
function SampleAccess() {
  const params = useSearchParams();
  const offerId = params.get('offer');
  const destination = params.get('destination');
  const [kind, setKind] = useState<OpportunityKind | 'all'>('all');
  const selectedRef = useRef<HTMLHeadingElement | null>(null);
  const selected = offerId ? getOpportunity(offerId.toLowerCase()) : undefined;
  const pool = listOpportunities().filter((offer) =>
    !destination || offer.destinationId.split('|')[0] === destination);
  const scoped = destination && pool.length > 0 ? pool : listOpportunities();
  const kinds = OPPORTUNITY_KINDS.filter((item) => scoped.some((offer) => offer.kind === item && offer.id !== selected?.id));
  const activeKind = kind !== 'all' && !kinds.includes(kind) ? 'all' : kind;
  const offers = scoped.filter((offer) =>
    (activeKind === 'all' || offer.kind === activeKind) && offer.id !== selected?.id,
  );
  const scopedLabel = destination && pool.length > 0 ? pool[0]?.destinationLabel : null;

  useEffect(() => {
    if (!selected) return;
    track('access_offer_opened', { id: selected.id });
    selectedRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    selectedRef.current?.focus({ preventScroll: true });
  }, [selected]);

  return (
    <main className={styles.page}>
      <AccessHero note="Place archive photography · sample opportunities, not live inventory" />

      <div className={styles.content}>
        <p className={styles.disclosure}>{ACCESS_FIXTURE_DISCLOSURE}</p>
        <section className={styles.path} aria-label="How access works">
          <div><span>01 / DISCOVER</span><p>Choose a stay, arrival or experience that fits your trip.</p></div>
          <div><span>02 / ASK</span><p>Draft the request you would make. No provider is contacted in this preview.</p></div>
          <div><span>03 / CONFIRM</span><p>In a connected service, the provider would confirm terms before any reservation.</p></div>
        </section>

        {offerId && !selected && (
          <p className={styles.empty} role="status">That sample is no longer listed. Here are the others.</p>
        )}

        {selected && (
          <section className={styles.selected} aria-labelledby="selected-offer-title">
            <div className={styles.sectionTop}><p className={styles.eyebrow}>YOUR SELECTED SAMPLE</p><Link href="/access">See all opportunities ↗</Link></div>
            <div className={styles.selectedGrid}>
              <OfferScene offer={selected} />
              <div className={styles.selectedBody}>
                <p className={styles.offerKind}>{OPPORTUNITY_KIND_LABEL[selected.kind]} · Sample · {selected.availabilityLabel}</p>
                <h2 id="selected-offer-title" ref={selectedRef} tabIndex={-1} className={styles.selectedTitle}>{selected.title}</h2>
                <p className={styles.offerSubtitle}>{selected.subtitle} · {offerWindowLabel(selected)}</p>
                <p className={styles.offerBody}>{selected.body}</p>
                <div className={styles.provider}><span>Sample provider · {selected.providerName}</span><span>{selected.priceLabel}</span></div>
                <InquiryBox key={selected.id} offer={selected} />
              </div>
            </div>
          </section>
        )}

        <section id="opportunities" className={styles.listing} aria-labelledby="opportunities-title">
          <div className={styles.listingHeader}>
            <div><p className={styles.eyebrow}>THE POSSIBILITIES</p><h2 id="opportunities-title">{selected ? 'More ways to make it yours.' : 'Find your way in.'}</h2></div>
            <p>Every offer below is a sample. A real inquiry would depend on the provider confirming the dates, price and terms.</p>
          </div>
          {scopedLabel && (
            <p className={styles.scopeNote}>Showing samples for {scopedLabel}. <Link href="/access">See every destination ↗</Link></p>
          )}
          {kinds.length > 1 && (
            <div className={styles.filters} aria-label="Filter opportunities">
              {(['all', ...kinds] as const).map((item) => (
                <button key={item} type="button" className={activeKind === item ? styles.activeFilter : ''} aria-pressed={activeKind === item} onClick={() => setKind(item)}>
                  {item === 'all' ? 'All ideas' : OPPORTUNITY_KIND_LABEL[item]}
                </button>
              ))}
            </div>
          )}
          <div className={styles.offerGrid}>
            {offers.map((offer) => (
              <div className={styles.offerFrame} key={offer.id}>
                <OfferScene offer={offer} />
                <OpportunityCardView offer={offer} />
              </div>
            ))}
          </div>
          {offers.length === 0 && <p className={styles.empty}>No more samples here. Explore the world for your next destination.</p>}
        </section>
        <p className={styles.partnerNote}>Are you a travel provider? <Link href="/partners">Explore the partner studio ↗</Link></p>
      </div>
    </main>
  );
}

function destinationSlug(offer: OpportunityCard) {
  return offer.destinationId.split('|')[0];
}

/** Drafts the request a traveler would send. Nothing leaves this page. */
function InquiryBox({ offer }: { offer: OpportunityCard }) {
  const [dates, setDates] = useState(offer.windowLabel ?? '');
  const [party, setParty] = useState('');
  const [note, setNote] = useState('');
  const [previewed, setPreviewed] = useState(false);
  const draft = [
    `Request: ${offer.title} (${offer.destinationLabel})`,
    dates.trim() && `Dates: ${dates.trim()}`,
    party.trim() && `Party: ${party.trim()}`,
    note.trim() && `Note: ${note.trim()}`,
  ].filter(Boolean).join('\n');

  return (
    <div className={styles.inquiryBox}>
      <p>{SAMPLE_OFFER_NOTE}</p>
      <form
        className={styles.draftForm}
        onSubmit={(event) => {
          event.preventDefault();
          setPreviewed(true);
        }}
      >
        <label>Dates<input value={dates} maxLength={80} onChange={(event) => setDates(event.target.value)} placeholder="e.g. 20–27 Dec" /></label>
        <label>Party<input value={party} maxLength={40} onChange={(event) => setParty(event.target.value)} placeholder="e.g. 2 adults, 2 children" /></label>
        <label>Note<textarea value={note} maxLength={400} onChange={(event) => setNote(event.target.value)} placeholder="What would make this right for you?" /></label>
        <button type="submit">Preview my request <span aria-hidden="true">↗</span></button>
      </form>
      {previewed && (
        <div className={styles.previewStatus} role="status">
          <pre className={styles.draftText}>{draft}</pre>
          <p>Nothing was sent and nothing is held. Partners are not connected in this preview; when they are, requests like this go to the provider and replies appear in Community → Your requests.</p>
          <p>
            <Link href={`/destinations/${destinationSlug(offer)}`}>Keep planning {offer.destinationLabel} ↗</Link>
            {offer.eventId ? <> · <Link href={`/?event=${encodeURIComponent(offer.eventId)}`}>See the occasion ↗</Link></> : null}
          </p>
        </div>
      )}
    </div>
  );
}
