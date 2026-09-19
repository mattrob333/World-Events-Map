'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { EmptyState, Panel } from '@/components/ui';
import { FixtureBanner, OpportunityCardView } from '@/components/shell';
import {
  ACCESS_FIXTURE_DISCLOSURE,
  AVAILABILITY_COPY,
  OPPORTUNITY_KIND_LABEL,
  getOpportunity,
  listOpportunities,
  type OpportunityKind,
} from '@/lib/access';
import { track } from '@/lib/analytics';

const FILTERS: Array<OpportunityKind | 'all'> = [
  'all',
  'stay',
  'aviation',
  'ground',
  'event_access',
  'dining',
  'experience',
  'yacht',
  'advisor',
];

export function AccessFeed() {
  const params = useSearchParams();
  const offerId = params.get('offer');
  const [kind, setKind] = useState<OpportunityKind | 'all'>('all');
  const [inquiryFor, setInquiryFor] = useState<string | null>(null);
  const offers = listOpportunities().filter((offer) => kind === 'all' || offer.kind === kind);
  const selected = offerId ? getOpportunity(offerId) : undefined;

  useEffect(() => {
    if (selected) track('access_offer_opened', { id: selected.id });
  }, [selected]);

  return (
    <main className="px-4 py-10 sm:px-8">
      <p className="label-sm text-brass">Access</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Make the trip happen</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-muted">
        Stays, aircraft, ground, tables and local help — always as an inquiry until a provider confirms.
      </p>
      <div className="mt-4">
        <FixtureBanner>{ACCESS_FIXTURE_DISCLOSURE}</FixtureBanner>
      </div>
      <div className="mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            className={`label shrink-0 border px-2 py-1 ${kind === item ? 'border-brass text-brass' : 'border-ink/10 text-ink-muted'}`}
            onClick={() => setKind(item)}
          >
            {item === 'all' ? 'All' : OPPORTUNITY_KIND_LABEL[item]}
          </button>
        ))}
      </div>
      {selected && (
        <Panel className="mt-6" title="Selected opportunity" accent>
          <OpportunityCardView offer={selected} />
          <InquiryBox
            offerId={selected.id}
            sent={inquiryFor === selected.id}
            onSend={() => {
              setInquiryFor(selected.id);
              track('access_inquiry_sent', { id: selected.id });
            }}
          />
        </Panel>
      )}
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {offers.map((offer) => (
          <OpportunityCardView key={offer.id} offer={offer} />
        ))}
      </div>
      {offers.length === 0 && (
        <EmptyState title="No opportunities in this category yet." body="Categories stay visible even when empty so the marketplace shape is honest." />
      )}
      <p className="mt-10 text-[12px] text-ink-muted">
        Providers use the{' '}
        <Link href="/partners" className="text-brass">
          partner studio
        </Link>
        . Travelers should not have to.
      </p>
    </main>
  );
}

function InquiryBox({
  offerId,
  sent,
  onSend,
}: {
  offerId: string;
  sent: boolean;
  onSend: () => void;
}) {
  const offer = getOpportunity(offerId);
  if (!offer) return null;
  if (sent) {
    return (
      <p className="mt-4 text-[13px] text-commit" role="status">
        Inquiry noted on this device. In production this becomes a provider conversation — still not a booking.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <p className="text-[12px] text-ink-muted">{AVAILABILITY_COPY[offer.availability]}</p>
      <button
        type="button"
        className="mt-3 label h-8 border border-brass/50 px-3 text-brass"
        onClick={onSend}
      >
        Send inquiry
      </button>
    </div>
  );
}
