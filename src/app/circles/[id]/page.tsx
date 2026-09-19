import { TripRoom } from '@/components/trip-room/TripRoom';

export default async function CircleTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TripRoom id={id} />;
}
