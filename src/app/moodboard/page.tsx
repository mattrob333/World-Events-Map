import type { Metadata } from 'next';
import { MoodboardStudio } from '@/components/designer/MoodboardStudio';

export const metadata: Metadata = {
  title: 'Mood board · MERIDIAN',
  description: 'Talk about yourself and get a travel mood board that plans trips with you.',
};

export default function MoodboardPage() {
  return <MoodboardStudio />;
}
