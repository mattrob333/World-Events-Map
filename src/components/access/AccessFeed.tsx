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
        <div className={styles.heroImage} role="img" aria-label="Yachts in Port Hercule, Monaco, photographed in 2021" />
        <div className={styles.heroShade} />
        <span className={styles.heroCredit}>Photo, display crop: <a href="https://commons.wikimedia.org/wiki/File:Monaco_Port_Hercule_17.jpg" target="_blank" rel="noreferrer">Zairon ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></span>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>MERIDIAN / ACCESS</p>
          <h1 id="access-title">Make the trip <em>happen.</em></h1>
          <p>Explore stays, arrivals and moments around the trip. Start with a possibility; the provider confirms every detail.</p>
          <a className={styles.heroAction} href="#opportunities">Explore opportunities <span aria-hidden="true">↘</span></a>
          <span className={styles.heroNote}>Place archive photography · preview opportunities, not live inventory</span>
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
