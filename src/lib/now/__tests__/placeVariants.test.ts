import { describe, expect, it } from 'vitest';
import { placeVariants } from '../placeVariants';

describe('placeVariants', () => {
  it('turns how people say it into what the map search wants, simplest last', () => {
    expect(placeVariants('Flushing, Queens in New York')).toEqual(['Flushing, Queens in New York', 'Flushing, Queens, New York', 'Flushing, New York']);
  });
  it('leaves a plain place alone', () => {
    expect(placeVariants('Brooklyn')).toEqual(['Brooklyn']);
    expect(placeVariants('Shoreditch, London')).toEqual(['Shoreditch, London', 'Shoreditch']);
  });
});
