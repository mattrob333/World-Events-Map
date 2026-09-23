import type { Metadata } from 'next';
import { MoodboardStudio } from '@/components/designer/MoodboardStudio';

export const metadata: Metadata = {
  title: 'Mood board · dope.travel',
  description: 'Talk about yourself, add your Spotify, and get a travel board that plans trips with you.',
};

export default async function MoodboardPage({ searchParams }: { searchParams: Promise<{ spotify?: string }> }) {
  const { spotify } = await searchParams;
  return <MoodboardStudio spotifyJustConnected={spotify === 'connected'} />;
}
