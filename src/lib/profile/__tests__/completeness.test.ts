import { describe, expect, it } from 'vitest';
import { profileCompleteness, profileMilestones } from '../completeness';
import type { TravelerProfileDraft } from '../types';

const blank: TravelerProfileDraft = {
  display_name: '',
  handle: '',
  headline: '',
  bio: '',
  avatar_url: '',
  cover_url: '',
  profile_theme: 'midnight',
  home_city: '',
  home_airport: '',
  interests: [],
  is_public: false,
  show_home_base: true,
  show_travel_modes: true,
};

describe('traveler profile completeness', () => {
  it('starts at zero and tops out at 100', () => {
    expect(profileCompleteness(blank, { links: 0, places: 0, content: 0, travelModes: 0 })).toBe(0);

    const complete: TravelerProfileDraft = {
      ...blank,
      display_name: 'Traveler A',
      handle: 'traveler_a',
      headline: 'Mountains, food and a good crew',
      bio: 'I plan trips around great snow, great meals and people who are excited to explore.',
      home_city: 'Atlanta',
      home_airport: 'KATL',
      interests: ['skiing', 'food', 'motorsport'],
    };
    expect(
      profileCompleteness(complete, { links: 1, places: 3, content: 1, travelModes: 1 }),
    ).toBe(100);
  });

  it('keeps milestones explainable', () => {
    const profile = { ...blank, display_name: 'A', handle: 'traveler_a', headline: 'Go' };
    const milestones = profileMilestones(profile, {
      links: 0,
      places: 0,
      content: 0,
      travelModes: 0,
    });
    expect(milestones.find((item) => item.id === 'identity')?.complete).toBe(true);
    expect(milestones.reduce((sum, item) => sum + item.points, 0)).toBe(100);
  });
});
