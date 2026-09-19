import { CirclesIndex } from '@/components/trip-room/TripRoom';

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string }>;
}) {
  const { destination } = await searchParams;
  return <CirclesIndex destination={destination} />;
}
