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
