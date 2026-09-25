'use client';

import { useHydrated } from '@/components/designer/useHydrated';
import { profileArtists } from '@/lib/designer/profile';
import { pickActiveProfile, useDesignerStore } from '@/lib/designer/store';
import { LiveShows } from './LiveShows';

/** The home page's music map: only when the active Vibe profile has artists (Spotify or typed). */
export function HomeMusicMap() {
  const hydrated = useHydrated();
  const board = useDesignerStore((state) => pickActiveProfile(state.profiles, state.activeProfileId));
  if (!hydrated || !board) return null;
  const artists = profileArtists(board.profile).slice(0, 5);
  if (!artists.length) return null;
  // No taste sent from here: the home page never spends the Jev budget.
  return <LiveShows artists={artists} hometown={board.profile.hometown} />;
}
