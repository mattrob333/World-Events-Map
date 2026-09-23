import { CirclesIndex } from '@/components/trip-room/TripRoom';

export default async function CirclesPage({
  searchParams,
}: {
  searchParams: Promise<{ destination?: string; event?: string }>;
}) {
  const { destination, event } = await searchParams;
  return <CirclesIndex destination={destination} eventId={event} />;
}
