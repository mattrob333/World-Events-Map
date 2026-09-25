import { describe, expect, it } from 'vitest';
import type { Participant } from './itinerary';
import { votersOf } from './voters';

const person = (id: string, kind: Participant['kind'] = 'adult'): Participant => ({ id, name: id, kind, tags: [], color: '#000', emoji: '🙂' }) as Participant;

describe('votersOf', () => {
  const family = [person('mom'), person('dad'), person('kid1', 'kid'), person('kid2', 'kid')];

  it('leaves kids off the voter list', () => {
    expect(votersOf(family, false).map((p) => p.id)).toEqual(['mom', 'dad']);
  });

  it('never offers the organizer on a guest copy, and still skips kids', () => {
    expect(votersOf(family, true, 'dad').map((p) => p.id)).toEqual(['dad']);
  });

  it('keeps everyone when nobody listed is a grown-up', () => {
    expect(votersOf([person('a', 'kid'), person('b', 'kid')], false)).toHaveLength(2);
  });
});
