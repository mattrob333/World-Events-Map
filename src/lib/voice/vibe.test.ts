import { describe, expect, it } from 'vitest';
import { emptyProfile, withVoiceStyle } from '@/lib/designer/profile';
import { voiceName } from './session';
import { INTENT_TOOLS, voiceInstructions } from './tools';
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

describe('Vibe stage voice sessions', () => {
  it('gives the profile and trip conversations only their own tools', () => {
    expect(INTENT_TOOLS.vibe_profile).toEqual(['lock_fact', 'describe_me', 'switch_profile']);
    expect(INTENT_TOOLS.vibe_trip).toEqual(['lock_fact', 'finish_trip', 'switch_profile']);
  });

  it('tells the trip concierge to be brief and to leave ranking to the app', () => {
    const text = voiceInstructions('vibe_trip', '', '2026-09-25');
    expect(text).toMatch(/under 12 words/);
    expect(text).toMatch(/never praise/i);
    expect(text).toMatch(/Late-night bars or live-music bars/);
    expect(text).toMatch(/finish_trip/);
    expect(text).toContain('where (Where:');
  });

  it('picks the voice from VOICE_NAME, falling back to marin', () => {
    const before = process.env.VOICE_NAME;
    process.env.VOICE_NAME = 'Cedar';
    expect(voiceName()).toBe('cedar');
    process.env.VOICE_NAME = 'nova';
    expect(voiceName()).toBe('marin');
    process.env.VOICE_NAME = before;
  });
});

describe('profile style from the concierge', () => {
  it('merges pace, budget, hard no’s and splurge, ignoring junk', () => {
    const profile = withVoiceStyle(emptyProfile(), { pace: 'packed', budget: 'lavish', avoid: ['cruises', 7, ' tour buses '], splurge: 'Food and hotels; fly economy.' });
    expect(profile.style).toMatchObject({ pace: 'packed', avoid: ['cruises', 'tour buses'], notes: 'Splurge and save: Food and hotels; fly economy.' });
    expect(profile.style?.budget).toBeUndefined();
    expect(withVoiceStyle(emptyProfile(), null).style).toBeUndefined();
  });
});
