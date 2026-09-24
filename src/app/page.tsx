import { DiscoveryExperience } from '@/components/discovery/DiscoveryExperience';
import { Suspense } from 'react';

// Rendered per request so the hero, calendar and shortlist arrive in the HTML.
// As a static page, reading the URL (?event=, ?journey=) bailed the whole
// experience out to a client-only render behind "Opening your world…".
export const dynamic = 'force-dynamic';

export default function MeridianPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-void text-ink"><p className="font-display text-2xl">Opening your world…</p></main>}><DiscoveryExperience /></Suspense>;
}
