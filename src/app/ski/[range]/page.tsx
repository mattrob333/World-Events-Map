import type { Metadata } from 'next';
import { RangeView } from '@/components/ski/RangeView';
import { RANGE_BY_ID } from '@/lib/ski/ranges';

export async function generateMetadata({ params }: { params: Promise<{ range: string }> }): Promise<Metadata> {
  const { range } = await params;
  const name = RANGE_BY_ID.get(range)?.name;
  return { title: `${name ? `Ski ${name}` : 'Ski resorts'} · dope.travel` };
}

export default async function SkiRangePage({ params }: { params: Promise<{ range: string }> }) {
  const { range } = await params;
  return <RangeView rangeId={range.slice(0, 60)} />;
}
