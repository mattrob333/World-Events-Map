import { TravelerProfile } from '@/components/profile/TravelerProfile';

export default async function TravelerProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <TravelerProfile handle={handle} />;
}
