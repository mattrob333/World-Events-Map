import type { Metadata } from 'next';
import { JoinTrip } from '@/components/designer/JoinTrip';

export const metadata: Metadata = {
  title: 'Join the trip · dope.travel',
  description: 'Open a shared trip, vote on the plan, and send your picks back.',
  robots: { index: false, follow: false },
};

export default function JoinTripPage() {
  return <JoinTrip />;
}
