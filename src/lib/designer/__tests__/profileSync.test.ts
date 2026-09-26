import { describe, expect, it } from 'vitest';
import { mergeProfiles, tombstone, type RemoteProfile } from '../profileSync';
import { normalizeProfile } from '../profile';
import type { SavedProfile } from '../store';

const saved = (id: string, at: string, name = 'Local'): SavedProfile => ({ id, profile: normalizeProfile({ name }), engine: 'claude', updatedAt: at });
const remote = (id: string, at: string, name = 'Remote', deleted = false): RemoteProfile => ({ local_id: id, label: 'Family', engine: 'claude', data: deleted ? {} : { name }, deleted, updated_at: at });

describe('mergeProfiles', () => {
  it('takes the newer copy of each profile and pushes what only this device has', () => {
    const { profiles, push } = mergeProfiles(
      [saved('mb-a', '2026-09-20T00:00:00Z'), saved('mb-b', '2026-09-25T00:00:00Z'), saved('mb-c', '2026-09-26T00:00:00Z')],
      [remote('mb-a', '2026-09-24T00:00:00Z', 'From phone'), remote('mb-b', '2026-09-21T00:00:00Z'), remote('mb-d', '2026-09-22T00:00:00Z', 'Only in account')],
    );
    expect(profiles.map((p) => [p.id, p.profile.name])).toEqual([['mb-c', 'Local'], ['mb-b', 'Local'], ['mb-a', 'From phone'], ['mb-d', 'Only in account']]);
    expect(push.map((p) => p.id).sort()).toEqual(['mb-b', 'mb-c']);
    expect(profiles.find((p) => p.id === 'mb-a')?.label).toBe('Family');
  });

  it('a newer deletion removes the profile; an older one is overruled', () => {
    const { profiles, push } = mergeProfiles(
      [saved('mb-gone', '2026-09-20T00:00:00Z'), saved('mb-kept', '2026-09-26T00:00:00Z')],
      [remote('mb-gone', '2026-09-24T00:00:00Z', '', true), remote('mb-kept', '2026-09-25T00:00:00Z', '', true)],
    );
    expect(profiles.map((p) => p.id)).toEqual(['mb-kept']);
    expect(push.map((p) => p.id)).toEqual(['mb-kept']);
  });

  it('ignores rows it could never have written, and cleans remote data', () => {
    const { profiles } = mergeProfiles([], [remote('bad id!', '2026-09-24T00:00:00Z'), { ...remote('mb-x', '2026-09-24T00:00:00Z'), data: { name: 42, family: 'nope' } }]);
    expect(profiles.map((p) => p.id)).toEqual(['mb-x']);
    expect(profiles[0].profile.family).toEqual([]);
  });

  it('tombstones carry no data', () => {
    expect(tombstone('mb-a', new Date('2026-09-26T00:00:00Z'))).toEqual({ local_id: 'mb-a', label: null, engine: 'on-device', data: {}, deleted: true, updated_at: '2026-09-26T00:00:00.000Z' });
  });
});

import { knownAfterMerge, pendingPush, syncAllowed } from '../profileSync';

describe('who syncs, and what counts as deleted', () => {
  it('never syncs another account’s profiles: A signs out, B signs in on the same browser', () => {
    expect(syncAllowed(true, 'user-a', 'user-a')).toBe(true);
    expect(syncAllowed(true, 'user-a', 'user-b')).toBe(false);
    expect(syncAllowed(true, null, 'user-b')).toBe(false);
    expect(syncAllowed(false, 'user-b', 'user-b')).toBe(false);
    expect(syncAllowed(true, 'user-a', null)).toBe(false);
  });

  it('a profile the merge had no room for stays in the account (not tombstoned)', () => {
    const phone = Array.from({ length: 8 }, (_, i) => remote(`mb-phone${i}`, `2026-09-1${i}T00:00:00Z`));
    const laptop = Array.from({ length: 8 }, (_, i) => saved(`mb-lap${i}`, `2026-09-2${i}T00:00:00Z`));
    const { profiles, push } = mergeProfiles(laptop, phone);
    expect(profiles).toHaveLength(12);
    const known = knownAfterMerge(profiles, push);
    const { removed } = pendingPush(profiles, known);
    expect(removed).toEqual([]);
    expect([...known.keys()].every((id) => profiles.some((p) => p.id === id))).toBe(true);
  });

  it('a removal here is pushed as a deletion; an edit as a change', () => {
    const a = saved('mb-a', '2026-09-20T00:00:00Z');
    const b = saved('mb-b', '2026-09-20T00:00:00Z');
    const known = knownAfterMerge([a, b], []);
    const edited = { ...a, updatedAt: '2026-09-26T00:00:00Z' };
    expect(pendingPush([edited], known)).toEqual({ changed: [edited], removed: ['mb-b'] });
  });
});
