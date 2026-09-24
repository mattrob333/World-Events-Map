import Link from 'next/link';
import { cn } from '@/components/ui';
import {
  AVAILABILITY_COPY,
  OPPORTUNITY_KIND_LABEL,
  SAMPLE_OFFER_NOTE,
  offerWindowLabel,
  type OpportunityCard,
} from '@/lib/access';

export function OpportunityCardView({
  offer,
  className,
}: {
  offer: OpportunityCard;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'surface flex flex-col gap-3 p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{OPPORTUNITY_KIND_LABEL[offer.kind]}</span>
          {offer.sample ? <span className="tag">Sample</span> : null}
        </span>
        <span className="tag">{offer.availabilityLabel}</span>
      </div>
      <div>
        <h3 className="font-display text-[22px] leading-tight text-ink">{offer.title}</h3>
        <p className="mt-1 text-[13px] text-ink-muted">{offer.subtitle} · {offerWindowLabel(offer)}</p>
      </div>
      <p className="text-[13px] leading-5 text-ink-muted">{offer.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-ink">{offer.sample ? `Sample provider · ${offer.providerName}` : offer.providerName}</p>
          <p className="text-[12px] text-ink-muted">{offer.priceLabel}</p>
        </div>
        <Link href={offer.href} className="btn btn-ghost btn-sm">
          {offer.sample ? 'View sample' : 'View offer'}
        </Link>
      </div>
      <p className="text-[12px] leading-4 text-ink-subtle">
        {offer.sample ? SAMPLE_OFFER_NOTE : AVAILABILITY_COPY[offer.availability]}
      </p>
    </article>
  );
}
