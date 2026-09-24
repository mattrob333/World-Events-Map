import { describe, expect, it } from 'vitest';
import { INTENT_TOOLS } from './tools';
import { placeFromTypedTrip, readTypedVibe, vibeTarget } from './vibe';

describe('header Vibe routing', () => {
  it('opens the page that owns each tool', () => {
    expect(vibeTarget('describe_me', {})).toEqual({ intent: 'board', href: '/moodboard' });
    expect(vibeTarget('set_now_city', { city: 'Tokyo' })).toEqual({ intent: 'now', href: '/now' });
    expect(vibeTarget('set_trip_basics', { place: 'Lisbon, Portugal' })).toEqual({
      intent: 'trip',
      href: '/trips/designer?place=Lisbon&region=Portugal',
    });
    expect(vibeTarget('set_trip_basics', { place: '<script>' })).toEqual({ intent: 'trip', href: '/trips/designer' });
    expect(vibeTarget('create_trip', {})).toEqual({ intent: 'trip', href: '/trips/designer' });
    expect(vibeTarget('navigate', { to: 'home' })).toBeNull();
    expect(vibeTarget('switch_profile', { name: 'Solo' })).toBeNull();
  });

  it('gives every forwarded tool a home page', () => {
    const global = new Set(['navigate', 'switch_profile']);
    for (const tool of INTENT_TOOLS.vibe) {
      if (!global.has(tool)) expect(vibeTarget(tool, { place: 'Lisbon' }), tool).not.toBeNull();
    }
  });

  it('reads the place a typed trip starts with', () => {
    expect(placeFromTypedTrip('Lisbon, second week of October, me and Sam')).toEqual({ place: 'Lisbon' });
    expect(placeFromTypedTrip('Lisbon, Portugal in October')).toEqual({ place: 'Lisbon', region: 'Portugal' });
    expect(placeFromTypedTrip('trip to Tokyo with the crew')).toEqual({ place: 'Tokyo' });
    expect(placeFromTypedTrip('we want to go to Mexico City next spring')).toEqual({ place: 'Mexico City' });
  });

  it('sends talk about yourself to the profile and places to a trip', () => {
    expect(readTypedVibe("I'm from Atlanta, I root for the Braves and I love omakase", false)).toEqual({ kind: 'profile' });
    expect(readTypedVibe('My kids are 8 and 12', true)).toEqual({ kind: 'profile' });
    expect(readTypedVibe('Lisbon, second week of October, me and Sam', false)).toEqual({ kind: 'trip', place: { place: 'Lisbon' } });
    expect(readTypedVibe('somewhere warm with good bars and no crowds at all please', true)).toEqual({ kind: 'trip', place: null });
    expect(readTypedVibe('somewhere warm with good bars and no crowds at all please', false)).toEqual({ kind: 'profile' });
  });
});
