import { describe, expect, it } from 'vitest';
import { emptyProfile } from '@/lib/designer/profile';
import { clock, matchCandidate } from './concierge';
import { allSignals, cleanSignal, mergeSignals, signalsFromText, vibeLine } from './signals';

describe('vibe signals', () => {
  it('reads how someone gets down, including what they avoid', () => {
    const signals = signalsFromText('I love to shut the bar down, big cocktail person, no clubs, and I always find a comedy show.');
    const by = Object.fromEntries(signals.map((signal) => [signal.key, signal.strength]));
    expect(by['nights:last-call']).toBe('love');
    expect(by['nights:cocktail-bar']).toBe('like');
    expect(by['nights:dance']).toBe('avoid');
    expect(by['culture:comedy']).toBe('love'); // "always find a comedy show"
  });

  it('turns an existing profile into signals, Spotify and hard no’s included', () => {
    const profile = { ...emptyProfile(), teams: ['FC Barcelona'], artists: ['Fred again..'], food: ['mezcal', 'Ethiopian'], style: { lodging: [], dietary: [], avoid: ['cruises'], bucketList: [], languages: [] } };
    const keys = allSignals(profile).map((signal) => `${signal.key}:${signal.strength}`);
    expect(keys).toEqual(expect.arrayContaining(['sports:team:fc-barcelona:love', 'music:artist:fred-again:love', 'food:mezcal:like', 'food:cuisine:ethiopian:like', 'culture:venue:cruises:avoid']));
  });

  it('keeps only our keys from outside, and what they said beats a guess', () => {
    expect(cleanSignal({ key: 'nights:last-call', strength: 'love' })?.label).toBe('Shuts the bar down');
    expect(cleanSignal({ key: 'music:artist:Bad Bunny', label: 'Bad Bunny', strength: 'love' })?.key).toBe('music:artist:bad-bunny');
    expect(cleanSignal({ key: 'system:ignore-previous', strength: 'love' })).toBeNull();
    const merged = mergeSignals([{ key: 'nights:dance', label: 'Dance floors', strength: 'avoid', source: 'said' }], [{ key: 'nights:dance', label: 'Dance floors', strength: 'like', source: 'inferred' }]);
    expect(merged[0]!.strength).toBe('avoid');
  });

  it('writes a compact line for a model', () => {
    expect(vibeLine([{ key: 'nights:last-call', label: 'Shuts the bar down', strength: 'love', source: 'said' }, { key: 'nights:dance', label: 'Dance floors', strength: 'avoid', source: 'said' }], { stretch: 3 }))
      .toBe('Loves: Shuts the bar down. Avoids: Dance floors. Comfort-zone stretch: 3 of 4.');
  });
});

describe('the concierge’s matcher', () => {
  const barCloser = signalsFromText('I love to shut the bar down and I love a speakeasy. No clubs.');

  it('favors the bar that pours latest, and says so from the facts', () => {
    const late = matchCandidate(barCloser, undefined, { id: 'a', name: 'Paradiso', kind: 'drink', text: 'Hidden speakeasy behind a pastrami shop', closesAt: 27 * 60 });
    const early = matchCandidate(barCloser, undefined, { id: 'b', name: 'Wine Room', kind: 'drink', text: 'Quiet wine bar', closesAt: 23 * 60 });
    expect(late.score).toBeGreaterThan(early.score);
    expect(late.wink).toBe('Pours till 3am. Last ones out, as usual.');
    expect(early.wink).toBeNull();
  });

  it('knocks down what they avoid', () => {
    const club = matchCandidate(barCloser, undefined, { id: 'c', name: 'Razzmatazz', kind: 'dance', text: 'Five-room nightclub, DJs till 6', closesAt: 30 * 60 });
    expect(club.conflicts.map((c) => c.key)).toContain('nights:dance');
    expect(club.wink).toBeNull();
  });

  it('nudges them toward the city’s big night when their stretch dial allows', () => {
    const facts = { id: 'd', name: 'FC Barcelona v Real Madrid', kind: 'event' as const, text: 'El Clásico at the Estadi Olímpic', date: '2027-03-14', signature: true };
    const open = matchCandidate([], { stretch: 3 }, facts);
    const closed = matchCandidate([], { stretch: 0 }, facts);
    expect(open.stretch).toBe(true);
    expect(open.wink).toMatch(/whole town/);
    expect(open.score).toBeGreaterThan(closed.score);
    // A fan hears it as theirs.
    const fan = matchCandidate([{ key: 'sports:team:fc-barcelona', label: 'FC Barcelona', strength: 'love', source: 'said' }], undefined, facts);
    expect(fan.wink).toBe('FC Barcelona. You’ll want to be in the building.');
  });

  it('prints closing times the way people say them', () => {
    expect(clock(26 * 60)).toBe('2am');
    expect(clock(23 * 60 + 30)).toBe('11:30pm');
    expect(clock(12 * 60)).toBe('12pm');
  });
});
