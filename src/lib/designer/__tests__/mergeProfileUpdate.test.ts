import { describe, expect, it } from 'vitest';
import { mergeProfileUpdate, normalizeProfile, parseProfileLocally } from '../profile';

describe('mergeProfileUpdate', () => {
  it('adds what was said without dropping what was there', () => {
    const before = parseProfileLocally('I live in Atlanta. I love classic rock and samba, BBQ and sushi. Braves fan.');
    const after = parseProfileLocally('We got really into jazz this year.');
    const merged = mergeProfileUpdate(before, after);
    expect(merged.hometown).toBe(before.hometown);
    expect(merged.music).toEqual(expect.arrayContaining(['Jazz', ...before.music]));
    expect(merged.food).toEqual(before.food);
    expect(merged.teams).toEqual(before.teams);
  });
});

describe('family, counted once', () => {
  it('reads "two sons … two boys" as the same two kids, and never names the wife "and"', () => {
    const p = parseProfileLocally("I've got a wife and two sons. One of my sons is 12 years old. One of my sons is 8 years old. Two boys, um, They love snow skiing. My wife and I like house music.");
    expect(p.family.map((m) => `${m.label}${m.age ?? ''}${m.name ? `:${m.name}` : ''}`)).toEqual(['Son12', 'Son8', 'Wife']);
  });
  it('cleans up a saved profile that counted them twice', () => {
    const saved = normalizeProfile({ family: [
      { relation: 'child', label: 'Son', age: 12 }, { relation: 'child', label: 'Son', age: 8 }, { relation: 'child', label: 'Son' }, { relation: 'child', label: 'Son' },
      { relation: 'child', label: 'Son', age: 12 }, { relation: 'child', label: 'Son', age: 8 }, { relation: 'partner', label: 'Wife', name: 'and' },
    ] });
    expect(saved.family).toHaveLength(3);
  });
});

describe('updates never double-count or wipe', () => {
  const people = (family: { label: string; age?: number; name?: string }[]) => family.map((m) => `${m.label}${m.age ?? ''}${m.name ? `:${m.name}` : ''}`).sort();
  const withFamily = (family: unknown[]) => normalizeProfile({ family });

  it('"two sons, 12 and 8" after Leo 12 and Max 8 is still two sons', () => {
    const before = withFamily([{ relation: 'child', label: 'Son', name: 'Leo', age: 12 }, { relation: 'child', label: 'Son', name: 'Max', age: 8 }]);
    const merged = mergeProfileUpdate(before, parseProfileLocally('We have two sons, 12 and 8.'));
    expect(people(merged.family)).toEqual(['Son12:Leo', 'Son8:Max']);
  });
  it('"my wife" after Wife Kelly is still Kelly', () => {
    const before = withFamily([{ relation: 'partner', label: 'Wife', name: 'Kelly' }]);
    const merged = mergeProfileUpdate(before, parseProfileLocally('My wife loves jazz.'));
    expect(people(merged.family)).toEqual(['Wife:Kelly']);
  });
  it('naming one of two unnamed sons names him, no third son', () => {
    const before = withFamily([{ relation: 'child', label: 'Son', age: 12 }, { relation: 'child', label: 'Son', age: 8 }]);
    const merged = mergeProfileUpdate(before, withFamily([{ relation: 'child', label: 'Son', name: 'Leo', age: 12 }]));
    expect(people(merged.family)).toEqual(['Son12:Leo', 'Son8']);
  });
  it('keeps pace, budget and the lists when the update never mentions them', () => {
    const before = normalizeProfile({ style: { pace: 'slow', budget: 'premium', lodging: ['villa'], dietary: ['vegetarian'], avoid: ['cruises'], bucketList: ['Patagonia'], languages: ['Spanish'], notes: 'Loves long lunches.' } });
    const after = normalizeProfile({ interests: ['live music'], style: { lodging: [], dietary: [], avoid: [], bucketList: [], languages: [] } });
    const style = mergeProfileUpdate(before, after).style!;
    expect(style).toMatchObject({ pace: 'slow', budget: 'premium', lodging: ['villa'], dietary: ['vegetarian'], avoid: ['cruises'], bucketList: ['Patagonia'], languages: ['Spanish'], notes: 'Loves long lunches.' });
  });
  it('reads digits as a count: "4 kids", "my 3 daughters"', () => {
    expect(parseProfileLocally('I have 4 kids.').family).toHaveLength(4);
    expect(parseProfileLocally('Traveling with my 3 daughters.').family).toHaveLength(3);
  });
});
