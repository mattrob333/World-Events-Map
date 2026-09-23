import type { Metadata } from 'next';
import { TripDesigner } from '@/components/designer/TripDesigner';

export const metadata: Metadata = {
  title: 'Trip designer · MERIDIAN',
  description: 'Design a group trip as a timeline of ideas everyone can drag, swipe, and vote on.',
};

export default async function TripDesignerPage({ searchParams }: { searchParams: Promise<{ with?: string }> }) {
  const { with: withBoard } = await searchParams;
  const board = typeof withBoard === 'string' && /^[a-z0-9-]{1,40}$/.test(withBoard) ? withBoard : undefined;
  return <TripDesigner initialWith={board} />;
}
