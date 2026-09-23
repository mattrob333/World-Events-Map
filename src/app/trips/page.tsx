import { TripsPage } from '@/components/trips/TripsPage';

export default async function TripsRoute({ searchParams }: { searchParams: Promise<{ season?: string; interest?: string }> }) {
  const { season, interest } = await searchParams;
  return <TripsPage featuredSki={season === 'winter' && interest === 'ski'} />;
}
