import { Suspense } from 'react';
import { AccessFeed } from '@/components/access/AccessFeed';

export default function AccessPage() {
  return (
    <Suspense fallback={<main className="px-4 py-16 text-ink-muted">Opening ACCESS…</main>}>
      <AccessFeed />
    </Suspense>
  );
}
