import { describe, expect, it } from 'vitest';
import { listTripRoomsForSlug } from '../fixtures';

describe('trip room fixtures', () => {
  it('finds the Aspen sample room from a destination slug', () => {
    const rooms = listTripRoomsForSlug('aspen');
    expect(rooms.map((room) => room.id)).toEqual(['aspen-holiday']);
  });

  it('does not invent a room for an unknown destination', () => {
    expect(listTripRoomsForSlug('st-moritz')).toEqual([]);
    expect(listTripRoomsForSlug('  ')).toEqual([]);
  });
});
