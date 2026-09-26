import type { Metadata } from 'next';
import { MoodboardStudio } from '@/components/designer/MoodboardStudio';
import { serverCapabilities } from '@/lib/designer/capabilities';

export const metadata: Metadata = {
  title: 'Traveler profile · dope.travel',
  description: 'Talk about yourself, add your Spotify, and get a traveler profile that plans trips with you.',
};

export default async function VibePage({ searchParams }: { searchParams: Promise<{ spotify?: string }> }) {
  const { spotify } = await searchParams;
  // Only the two Spotify booleans reach the client; no keys.
  const { spotifyPlaylist, spotifySignIn } = serverCapabilities();
  return <MoodboardStudio spotifyJustConnected={spotify === 'connected'} capabilities={{ spotifyPlaylist, spotifySignIn }} />;
}
