import { describe, expect, it } from 'vitest';
import { profileChecklist, tripChecklist } from './vibeChecklist';

const done = (items: { key: string; done: boolean }[]) => items.filter((item) => item.done).map((item) => item.key);

describe('vibe checklist', () => {
  it('starts empty', () => {
    expect(done(profileChecklist(''))).toEqual([]);
    expect(done(tripChecklist(''))).toEqual([]);
  });

  it('ticks profile topics as they are said', () => {
    const text = "I'm from Atlanta, huge Braves fan, I love Fred again and omakase, and I travel with my wife Jen and our kids Max 8 and Zoe 12.";
    expect(done(profileChecklist(text))).toEqual(expect.arrayContaining(['home', 'teams', 'food', 'crew']));
  });

  it('ticks trip topics as they are said', () => {
    const text = 'Lisbon, second week of October, me and Sam. We have to get one great seafood lunch and no touristy fado.';
    expect(done(tripChecklist(text))).toEqual(['where', 'when', 'who', 'must', 'not']);
  });
});
