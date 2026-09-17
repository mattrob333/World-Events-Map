import type { TravelerProfileDraft } from './types';

export interface ProfileInventory {
  links: number;
  places: number;
  content: number;
  travelModes: number;
}

export interface ProfileMilestone {
  id: string;
  label: string;
  points: number;
  complete: boolean;
}

export function profileMilestones(
  profile: TravelerProfileDraft,
  inventory: ProfileInventory,
): ProfileMilestone[] {
  return [
    {
      id: 'identity',
      label: 'Claim your traveler identity',
      points: 20,
      complete: Boolean(profile.display_name.trim() && profile.handle.trim() && profile.headline.trim()),
    },
    {
      id: 'story',
      label: 'Tell people what kind of traveler you are',
      points: 10,
      complete: profile.bio.trim().length >= 40,
    },
    {
      id: 'home',
      label: 'Add your home base',
      points: 10,
      complete: Boolean(profile.home_city.trim() || profile.home_airport.trim()),
    },
    {
      id: 'interests',
      label: 'Add at least three interests',
      points: 10,
      complete: profile.interests.length >= 3,
    },
    {
      id: 'modes',
      label: 'Create a travel mode',
      points: 15,
      complete: inventory.travelModes >= 1,
    },
    {
      id: 'places',
      label: 'Build your places shelf',
      points: 15,
      complete: inventory.places >= 3,
    },
    {
      id: 'content',
      label: 'Pin something that inspires you',
      points: 10,
      complete: inventory.content >= 1,
    },
    {
      id: 'social',
      label: 'Connect another travel identity',
      points: 10,
      complete: inventory.links >= 1,
    },
  ];
}

export function profileCompleteness(
  profile: TravelerProfileDraft,
  inventory: ProfileInventory,
): number {
  return profileMilestones(profile, inventory)
    .filter((milestone) => milestone.complete)
    .reduce((sum, milestone) => sum + milestone.points, 0);
}
