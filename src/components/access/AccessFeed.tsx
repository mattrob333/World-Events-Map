'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OpportunityCardView } from '@/components/shell';
import {
  ACCESS_FIXTURE_DISCLOSURE,
  AVAILABILITY_COPY,
  OPPORTUNITY_KIND_LABEL,
  getOpportunity,
  listOpportunities,
  type OpportunityCard,
  type OpportunityKind,
} from '@/lib/access';
import { track } from '@/lib/analytics';
import styles from './access.module.css';

const FILTERS: Array<OpportunityKind | 'all'> = [
  'all', 'stay', 'aviation', 'ground', 'event_access', 'dining', 'experience', 'yacht', 'advisor',
];

function sceneClass(offer: OpportunityCard): string {
  return offer.kind === 'yacht' || offer.destinationLabel === 'Monte-Carlo' ? styles.seaScene : styles.snowScene;
}

function OfferScene({ offer }: { offer: OpportunityCard }) {
  return (
    <div className={`${styles.offerScene} ${sceneClass(offer)}`} role="img" aria-label={`Illustrative travel scene for ${offer.destinationLabel}; this is not a photograph of the offer`}>
      <span className={styles.scenePlace}>{offer.destinationLabel}</span>
      <span className={styles.sceneLabel}>Illustrative scene</span>
    </div>
  );
}

export function AccessFeed() {
  const params = useSearchParams();
  const offerId = params.get('offer');
  const [kind, setKind] = useState<OpportunityKind | 'all'>('all');
  const [previewedInquiryFor, setPreviewedInquiryFor] = useState<string | null>(null);
  const selected = offerId ? getOpportunity(offerId) : undefined;
  const offers = listOpportunities().filter((offer) =>
    (kind === 'all' || offer.kind === kind) && offer.id !== selected?.id,
  );

  useEffect(() => {
    if (selected) track('access_offer_opened', { id: selected.id });
  }, [selected]);

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="access-title">
        <div className={styles.heroImage} role="img" aria-label="Illustrative ski terrace, yacht, and travel gatherings" />
        <div className={styles.heroShade} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>MERIDIAN / ACCESS</p>
          <h1 id="access-title">Make the trip <em>happen.</em></h1>
          <p>Explore stays, arrivals and moments around the trip. Start with a possibility; the provider confirms every detail.</p>
          <a className={styles.heroAction} href="#opportunities">Explore opportunities <span aria-hidden="true">↘</span></a>
          <span className={styles.heroNote}>Illustrative travel imagery · preview opportunities, not live inventory</span>
        </div>
      </section>

      <div className={styles.content}>
        <p className={styles.disclosure}>{ACCESS_FIXTURE_DISCLOSURE}</p>
        <section className={styles.path} aria-label="How access works">
          <div><span>01 / DISCOVER</span><p>Choose a stay, arrival or experience that fits your trip.</p></div>
          <div><span>02 / ASK</span><p>Preview the request you would make. No provider is contacted in this preview.</p></div>
          <div><span>03 / CONFIRM</span><p>In a connected service, the provider would confirm terms before any reservation.</p></div>
        </section>

        {selected && (
          <section className={styles.selected} aria-labelledby="selected-offer-title">
            <div className={styles.sectionTop}><p className={styles.eyebrow}>YOUR SELECTED POSSIBILITY</p><Link href="/access">See all opportunities ↗</Link></div>
            <div className={styles.selectedGrid}>
              <OfferScene offer={selected} />
              <div className={styles.selectedBody}>
                <p className={styles.offerKind}>{OPPORTUNITY_KIND_LABEL[selected.kind]} · {selected.availabilityLabel}</p>
                <h2 id="selected-offer-title">{selected.title}</h2>
                <p className={styles.offerSubtitle}>{selected.subtitle}{selected.windowLabel ? ` · ${selected.windowLabel}` : ''}</p>
                <p className={styles.offerBody}>{selected.body}</p>
                <div className={styles.provider}><span>{selected.providerName}</span><span>{selected.priceLabel}</span></div>
                <InquiryBox
                  offer={selected}
                  previewed={previewedInquiryFor === selected.id}
                  onPreview={() => setPreviewedInquiryFor(selected.id)}
                />
              </div>
            </div>
          </section>
        )}

        <section id="opportunities" className={styles.listing} aria-labelledby="opportunities-title">
          <div className={styles.listingHeader}>
            <div><p className={styles.eyebrow}>THE POSSIBILITIES</p><h2 id="opportunities-title">{selected ? 'More ways to make it yours.' : 'Find your way in.'}</h2></div>
            <p>Every offer below is a preview. A real inquiry would depend on the provider confirming the dates, price and terms.</p>
          </div>
          <div className={styles.filters} aria-label="Filter opportunities">
            {FILTERS.map((item) => (
              <button key={item} type="button" className={kind === item ? styles.activeFilter : ''} aria-pressed={kind === item} onClick={() => setKind(item)}>
                {item === 'all' ? 'All ideas' : OPPORTUNITY_KIND_LABEL[item]}
              </button>
            ))}
          </div>
          <div className={styles.offerGrid}>
            {offers.map((offer) => (
              <div className={styles.offerFrame} key={offer.id}>
                <OfferScene offer={offer} />
                <OpportunityCardView offer={offer} />
              </div>
            ))}
          </div>
          {offers.length === 0 && <p className={styles.empty}>No other preview opportunities in this category. Try another filter or explore the world for your next destination.</p>}
        </section>
        <p className={styles.partnerNote}>Are you a travel provider? <Link href="/partners">Explore the partner studio ↗</Link></p>
      </div>
    </main>
  );
}

function InquiryBox({ offer, previewed, onPreview }: { offer: OpportunityCard; previewed: boolean; onPreview: () => void }) {
  return (
    <div className={styles.inquiryBox}>
      <p>{AVAILABILITY_COPY[offer.availability]}</p>
      {previewed ? (
        <p className={styles.previewStatus} role="status">Inquiry preview noted on this page. No message was sent to a provider and no reservation was made.</p>
      ) : (
        <button type="button" onClick={onPreview}>Preview inquiry <span aria-hidden="true">↗</span></button>
      )}
    </div>
  );
}
