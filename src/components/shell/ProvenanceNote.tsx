import { PROVENANCE_LABEL, type ProvenanceKind } from '@/lib/pulse';
import { cn } from '@/components/ui';

export function ProvenanceNote({
  kind,
  children,
  className,
}: {
  kind: ProvenanceKind;
  children?: string;
  className?: string;
}) {
  return (
    <p className={cn('text-[12px] leading-5 text-ink-muted', className)}>
      <span className="eyebrow mr-2">{PROVENANCE_LABEL[kind]}</span>
      {children}
    </p>
  );
}

export function FixtureBanner({ children }: { children: string }) {
  return (
    <p
      role="note"
      className="notice"
    >
      {children}
    </p>
  );
}
