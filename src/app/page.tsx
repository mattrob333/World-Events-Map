import { DiscoveryExperience } from '@/components/discovery/DiscoveryExperience';
import { Suspense } from 'react';

export default function MeridianPage() {
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-void text-ink"><p className="font-display text-2xl">Opening your world…</p></main>}><DiscoveryExperience /></Suspense>;
}
