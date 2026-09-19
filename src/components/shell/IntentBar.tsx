'use client';

import Link from 'next/link';
import { Button, cn } from '@/components/ui';
import { INTENT_HINT, INTENT_LABEL, useIntentStore, type IntentTargetKind, type IntentVerb } from '@/lib/intent';

export function IntentBar({
  kind,
  id,
  label,
  href,
  startHref,
  className,
}: {
  kind: IntentTargetKind;
  id: string;
  label: string;
  href: string;
  startHref: string;
  className?: string;
}) {
  const has = useIntentStore((s) => s.has);
  const toggle = useIntentStore((s) => s.toggle);

  const verbs: IntentVerb[] = ['save', 'watch', 'idGo'];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {verbs.map((verb) => {
        const on = has(verb, kind, id);
        return (
          <Button
            key={verb}
            size="sm"
            variant={on ? 'brass' : 'ghost'}
            selected={on}
            aria-pressed={on}
            title={INTENT_HINT[verb]}
            onClick={() => toggle({ verb, kind, id, label, href })}
          >
            {INTENT_LABEL[verb]}
          </Button>
        );
      })}
      <Link
        href={startHref}
        className="inline-flex h-6 items-center rounded-[2px] border border-commit/50 bg-commit/10 px-3.5 label text-commit hover:border-commit hover:text-ink"
      >
        Start a Circle
      </Link>
    </div>
  );
}
