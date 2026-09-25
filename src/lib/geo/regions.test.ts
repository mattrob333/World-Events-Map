import { describe, expect, it } from 'vitest';
import { inWheres, wheresIn } from './regions';
import { tripCrew, tripWhen } from '@/lib/voice/vibe';

const ask = "I want to go on a ski trip. I want it to be in the Alps. I want the coolest place in the Alps, the hottest new trendy ski resort in the Alps. I'm taking my family of four and another family of four. I want it to be for the first week in February.";

describe('reading a real trip request', () => {
  it('knows the Alps span several countries', () => {
    const [alps] = wheresIn(ask);
    expect(alps).toMatchObject({ label: 'the Alps', kind: 'region', hint: 'ski' });
    expect(inWheres('Switzerland', [alps!])).toBe(true);
    expect(inWheres('France', [alps!])).toBe(true);
    expect(inWheres('Japan', [alps!])).toBe(false);
    expect(inWheres('United States', [alps!])).toBe(false);
  });
  it('reads the week and the crew', () => {
    expect(tripWhen(ask, '2026-09-25')).toMatchObject({ start: '2027-02-01', nights: 7 });
    expect(tripCrew(ask)).toEqual({ people: 8, label: '2 families of four (8 people)'.replace('four', '4') });
  });
  it('reads countries and states', () => {
    expect(wheresIn('Somewhere in Switzerland or Japan').map((w) => w.label)).toEqual(['Switzerland', 'Japan']);
    expect(wheresIn('skiing in Colorado in March')[0]).toMatchObject({ kind: 'state', label: 'Colorado' });
    expect(wheresIn('a week in the Caribbean')[0]?.label).toBe('the Caribbean');
    expect(wheresIn('I want Turkey sandwiches')).toEqual([]);
  });
  it('counts other groups', () => {
    expect(tripCrew('me and my wife')?.people).toBe(2);
    expect(tripCrew('two couples')?.people).toBe(4);
    expect(tripCrew('me and 3 friends')?.people).toBe(4);
    expect(tripCrew('solo trip')?.people).toBe(1);
    expect(tripCrew('somewhere warm')).toBeNull();
  });
});
