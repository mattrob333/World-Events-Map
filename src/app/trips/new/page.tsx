import { redirect } from 'next/navigation';
import { TripsPage } from '@/components/trips/TripsPage';
import { spotTripHref } from '@/lib/activity/trip';

/** Start a trip: the ski planner, the designer and sample rooms. "Your trips" is /trips. */
export default async function NewTripRoute({ searchParams }: { searchParams: Promise<{ season?: string; interest?: string; event?: string; place?: string; month?: string }> }) {
  const { season, interest, event, place, month } = await searchParams;
  // "Plan a trip here" from a spot on the globe: straight into the designer, place and dates filled in.
  const spot = typeof place === 'string' ? spotTripHref(place, month, new Date()) : null;
  if (spot) redirect(spot);
  return (
    <TripsPage
      featuredSki={season === 'winter' && interest === 'ski'}
      eventId={typeof event === 'string' ? event.slice(0, 100) : ''}
    />
  );
}
