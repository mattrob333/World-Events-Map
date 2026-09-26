import { describe, expect, it } from 'vitest';
import { mergeProfileUpdate, parseProfileLocally } from '../profile';

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
