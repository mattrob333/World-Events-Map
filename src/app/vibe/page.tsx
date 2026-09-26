import type { Metadata } from 'next';
import { MoodboardStudio } from '@/components/designer/MoodboardStudio';
import { serverCapabilities } from '@/lib/designer/capabilities';

export const metadata: Metadata = {
  title: 'You · dope.travel',
  description: 'A traveler profile for everyone you travel with, built by talking for a minute, and the groups your trips are planned for.',
};

export default async function VibePage({ searchParams }: { searchParams: Promise<{ spotify?: string }> }) {
  const { spotify } = await searchParams;
  // Only the two Spotify booleans reach the client; no keys.
  const { spotifyPlaylist, spotifySignIn } = serverCapabilities();
  return <MoodboardStudio spotifyJustConnected={spotify === 'connected'} capabilities={{ spotifyPlaylist, spotifySignIn }} />;
}
