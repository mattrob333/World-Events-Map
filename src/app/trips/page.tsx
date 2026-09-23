import { TripsPage } from '@/components/trips/TripsPage';

export default async function TripsRoute({ searchParams }: { searchParams: Promise<{ season?: string; interest?: string; event?: string }> }) {
  const { season, interest, event } = await searchParams;
  return (
    <TripsPage
      featuredSki={season === 'winter' && interest === 'ski'}
      eventId={typeof event === 'string' ? event.slice(0, 100) : ''}
    />
  );
}
