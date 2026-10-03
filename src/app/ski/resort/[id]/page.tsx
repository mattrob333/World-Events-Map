import type { Metadata } from 'next';
import { ResortView } from '@/components/ski/ResortView';

export const metadata: Metadata = { title: 'Ski resort · dope.travel' };

export default async function SkiResortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResortView resortId={id.slice(0, 60)} />;
}
