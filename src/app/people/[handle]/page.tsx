import { TravelerProfile } from '@/components/people/People';

export default async function PersonPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <TravelerProfile handle={handle} />;
}
