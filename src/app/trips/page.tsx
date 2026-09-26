import { redirect } from 'next/navigation';
import { MyTrips } from '@/components/trips/MyTrips';

export default async function TripsRoute({ searchParams }: { searchParams: Promise<{ season?: string; interest?: string; event?: string }> }) {
  const { season, interest, event } = await searchParams;
  // Old planner links (/trips?season=winter&interest=ski&event=…) go to the planner.
  if (season || interest || event) {
    const query = new URLSearchParams();
    if (season) query.set('season', season.slice(0, 20));
    if (interest) query.set('interest', interest.slice(0, 20));
    if (event) query.set('event', event.slice(0, 100));
    redirect(`/trips/new?${query.toString()}`);
  }
  return <MyTrips />;
}
