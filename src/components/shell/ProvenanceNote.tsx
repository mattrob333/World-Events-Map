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
    <p className={cn('text-[11px] leading-4 text-ink-muted', className)}>
      <span className="label-sm mr-2 text-brass">{PROVENANCE_LABEL[kind]}</span>
      {children}
    </p>
  );
}

export function FixtureBanner({ children }: { children: string }) {
  return (
    <p
      role="note"
      className="border border-brass/25 bg-brass-wash px-3 py-2 text-[11px] leading-4 text-brass-bright"
    >
      {children}
    </p>
  );
}
