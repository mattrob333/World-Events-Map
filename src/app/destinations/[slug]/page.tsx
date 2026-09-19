import { DestinationPage } from '@/components/destination/DestinationPage';

export default async function DestinationRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <DestinationPage slug={slug} />;
}
