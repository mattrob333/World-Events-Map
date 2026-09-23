'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/**
 * Keeps the dope.travel shell (header, navigation) when a page throws, so a
 * rendering fault never leaves the traveler on a blank browser error.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-4 py-16">
      <span aria-hidden className="h-px w-8 bg-brass-deep" />
      <h1 className="font-display text-[28px] leading-tight text-ink">This view stopped working.</h1>
      <p className="text-[14px] leading-6 text-ink-muted">
        Something on this page failed to render. Nothing you saved on this device was changed.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="brass" onClick={() => retry()}>
          Try again
        </Button>
        <Link href="/" className="label text-ink-muted underline-offset-4 hover:text-ink hover:underline">
          Back to World
        </Link>
      </div>
    </main>
  );
}
