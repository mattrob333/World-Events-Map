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
});
