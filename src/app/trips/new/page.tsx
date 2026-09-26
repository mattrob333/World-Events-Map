import { TripsPage } from '@/components/trips/TripsPage';

/** Start a trip: the ski planner, the designer and sample rooms. "Your trips" is /trips. */
export default async function NewTripRoute({ searchParams }: { searchParams: Promise<{ season?: string; interest?: string; event?: string }> }) {
  const { season, interest, event } = await searchParams;
  return (
    <TripsPage
      featuredSki={season === 'winter' && interest === 'ski'}
      eventId={typeof event === 'string' ? event.slice(0, 100) : ''}
    />
  );
}
