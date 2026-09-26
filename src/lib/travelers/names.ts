import type { SavedProfile } from '@/lib/designer/store';

/** What to call a traveler: the name they gave the profile, else the one they said, else a plain placeholder. */
export function travelerName(entry: Pick<SavedProfile, 'label' | 'profile'>): string {
  return entry.label ?? entry.profile.name ?? 'Unnamed traveler';
}
