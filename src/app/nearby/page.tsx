import type { Metadata } from 'next';
import { NearbyPulse } from '@/components/now/NearbyPulse';

export const metadata: Metadata = {
  title: 'Vibe Now · dope.travel',
  description: 'What’s busy within five miles of you right now, from live and usual foot traffic.',
};

export default function NearbyPage() {
  return <NearbyPulse />;
}
