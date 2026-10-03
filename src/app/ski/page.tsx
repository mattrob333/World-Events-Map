import type { Metadata } from 'next';
import { SkiPlanner } from '@/components/ski/SkiPlanner';

export const metadata: Metadata = {
  title: 'Plan a ski trip · dope.travel',
  description: 'Pick your dates and see the world’s mountains sorted by snow and by everything around them you’d love.',
};

export default function SkiPage() {
  return <SkiPlanner />;
}
