import { describe, expect, it } from 'vitest';
import { EVENTS } from '@/lib/data/events';
import { eventSeason, matchesTripInterest } from '@/lib/discovery/seasonal';
import { editorialEventForMode, resolveGlobeStory } from './globe-story';

const medinah = EVENTS.find((event) => event.id === 'presidents-cup');
const kyoto = EVENTS.find((event) => event.id === 'kyoto-matsutake-kaiseki');

describe('globe story selection', () => {
  it('keeps the editorial nearest event until a place is chosen', () => {
    expect(resolveGlobeStory(null, EVENTS, medinah)).toEqual({
      event: medinah,
      selected: false,
    });
  });

  it('shows the exact Kyoto occasion even when it is outside today’s map scenes', () => {
    expect(kyoto).toBeDefined();
    expect(medinah).toBeDefined();
    expect(kyoto?.start).toBe('2026-10-01');
    expect(resolveGlobeStory(kyoto!.id, EVENTS, medinah)).toEqual({
      event: kyoto,
      selected: true,
    });
  });

  it('keeps a curated departure resolvable during a partial calendar refresh', () => {
    expect(resolveGlobeStory('kyoto-matsutake-kaiseki', [medinah!], medinah).event?.id)
      .toBe('kyoto-matsutake-kaiseki');
  });

  it('swaps a clicked winter stay for a summer coast editorial pick when the mode changes', () => {
    const focus = '2026-09-22';
    const winter = editorialEventForMode(EVENTS, focus, 'winter', 'ski');
    const summer = editorialEventForMode(EVENTS, focus, 'summer', 'coast');
    expect(winter?.category).toBe('ski');
    expect(winter && winter.start > focus).toBe(true);
    expect(summer).toBeDefined();
    expect(summer && eventSeason(summer)).toBe('summer');
    expect(summer && matchesTripInterest(summer, 'coast')).toBe(true);
    expect(resolveGlobeStory(null, EVENTS, summer)).toEqual({ event: summer, selected: false });
    expect(summer?.id).not.toBe(winter?.id);
  });

  it('has no editorial pick when that season has no future occasions', () => {
    expect(editorialEventForMode(EVENTS, '2027-10-01', 'winter', 'ski')).toBeUndefined();
  });
});
