import { PublicTravelerProfile } from '@/components/profile';

export default async function TravelerProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <PublicTravelerProfile handle={handle} />;
}
