import Link from 'next/link';
import { Button, cn } from '@/components/ui';
import { AVAILABILITY_COPY, OPPORTUNITY_KIND_LABEL, type OpportunityCard } from '@/lib/access';

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
        'glass flex flex-col gap-3 rounded-[3px] p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-sm text-brass">{OPPORTUNITY_KIND_LABEL[offer.kind]}</span>
        <span className="label-sm text-ink-muted">{offer.availabilityLabel}</span>
      </div>
      <div>
        <h3 className="font-display text-[22px] leading-tight text-ink">{offer.title}</h3>
        <p className="mt-1 text-[12px] text-ink-muted">{offer.subtitle}</p>
      </div>
      <p className="text-[13px] leading-5 text-ink-muted">{offer.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[12px] text-ink">{offer.providerName}</p>
          <p className="text-[11px] text-ink-muted">{offer.priceLabel}</p>
        </div>
        <Link href={offer.href}>
          <Button size="sm" variant="brass">
            Request details
          </Button>
        </Link>
      </div>
      <p className="text-[10px] leading-4 text-ink-faint">{AVAILABILITY_COPY[offer.availability]}</p>
    </article>
  );
}
