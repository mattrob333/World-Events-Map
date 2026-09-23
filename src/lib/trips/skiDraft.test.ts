import { describe, expect, it } from 'vitest';
import { clearSkiDrafts, skiDraftKey } from './skiDraft';

function memoryStorage(entries: Record<string, string>) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
    has: (key: string) => map.has(key),
  };
}

describe('family ski drafts on a shared device', () => {
  it('clears every owner’s draft, including the visitor draft, and nothing else', () => {
    const storage = memoryStorage({
      [skiDraftKey(null)]: '{"childNotes":"6 and 9"}',
      [skiDraftKey('user-a')]: '{"origin":"Atlanta"}',
      'meridian.viewing-city': 'Atlanta, Georgia',
    });
    clearSkiDrafts(storage);
    expect(storage.has(skiDraftKey(null))).toBe(false);
    expect(storage.has(skiDraftKey('user-a'))).toBe(false);
    expect(storage.has('meridian.viewing-city')).toBe(true);
  });
});
