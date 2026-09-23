import { Community, type CommunityTab } from '@/components/community/Community';

const TABS: readonly CommunityTab[] = ['circles', 'offers', 'requests'];

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ event?: string; tab?: string; circle?: string; offer?: string }> }) {
  const query = await searchParams;
  const tab = TABS.find((value) => value === query.tab) ?? 'circles';
  return (
    <Community
      initialEvent={typeof query.event === 'string' ? query.event : ''}
      initialCircle={typeof query.circle === 'string' ? query.circle : ''}
      initialTab={tab}
      initialOffer={typeof query.offer === 'string' ? query.offer.slice(0, 64) : ''}
    />
  );
}
