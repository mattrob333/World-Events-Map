import { describe, expect, it } from 'vitest';
import { askFromText } from './useNowFinder';

describe('askFromText', () => {
  it('reads where, what, energy and lateness from how people say it', () => {
    expect(askFromText('It’s 10:42 at night and I’m over here in Flushing, New York. Looking for a bar that stays open late with a decent amount of foot traffic.')).toEqual({
      what: 'drinks', energy: 'lively', late: true, where: 'Flushing, New York',
    });
  });
  it('uses their phone’s location when they don’t name a place', () => {
    expect(askFromText('something chill to eat')).toEqual({ what: 'food', energy: 'chill', late: false });
  });

  it.each([
    ["I'm in Brooklyn, want a quiet bar", 'Brooklyn'],
    ["I'm in Williamsburg, looking for food", 'Williamsburg'],
    ["We're at a wedding in Austin and want a late bar", 'Austin'],
    ["I'm in Flushing, Queens and it's 10:42", 'Flushing, Queens'],
  ])('finds the place in %s', (text, where) => {
    expect(askFromText(text).where).toBe(where);
  });
  it('does not take a mood for a place', () => {
    expect(askFromText("I'm in the mood for a bar").where).toBeUndefined();
  });
  it('reads "not too busy" as quiet', () => {
    expect(askFromText('not too busy please, a quiet bar').energy).toBe('chill');
    expect(askFromText('somewhere with no crowds').energy).toBe('chill');
  });
});
