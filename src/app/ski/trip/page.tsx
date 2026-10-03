import type { Metadata } from 'next';
import { TripView } from '@/components/ski/TripView';

export const metadata: Metadata = { title: 'Your ski trip · dope.travel' };

export default function SkiTripPage() {
  return <TripView />;
}
