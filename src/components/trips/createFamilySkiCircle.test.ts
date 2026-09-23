import { describe, expect, it, vi } from 'vitest';
import { createFamilySkiCircle } from './createFamilySkiCircle';
import type { FamilySkiInput } from './familySki';

const input: FamilySkiInput = {
  region: 'compare',
  start: '2027-02-12',
  end: '2027-02-19',
  origin: 'Atlanta',
  adults: 2,
  children: 2,
  anotherFamily: true,
  stay: 'slopeside',
  nightlyBudget: '1200',
};

describe('family trip auth switch', () => {
  it('does not post a private brief or return old results when sign-out happens during Circle creation', async () => {
    let finishCreate!: (id: string) => void;
    let current = true;
    const verifyOwner = vi.fn(async () => true);
    const savePrivateBrief = vi.fn(async () => {});
    const pending = createFamilySkiCircle(input, 'old-user', {
      createCircle: () => new Promise<string>((resolve) => { finishCreate = resolve; }),
      verifyOwner,
      savePrivateBrief,
      isCurrent: () => current,
    });

    current = false; // A sign-out or new account invalidates the mounted planner.
    finishCreate('30000000-0000-0000-0000-000000000001');
    expect(await pending).toEqual({ kind: 'stale' });
    expect(verifyOwner).not.toHaveBeenCalled();
    expect(savePrivateBrief).not.toHaveBeenCalled();
  });

  it('rechecks the provider identity before the private write', async () => {
    const savePrivateBrief = vi.fn(async () => {});
    const result = await createFamilySkiCircle(input, 'old-user', {
      createCircle: async () => '30000000-0000-0000-0000-000000000001',
      verifyOwner: async () => false, // Another account now owns the client session.
      savePrivateBrief,
      isCurrent: () => true,
    });
    expect(result).toEqual({ kind: 'stale' });
    expect(savePrivateBrief).not.toHaveBeenCalled();
  });

  it('discards a private-write completion after an account switch', async () => {
    let finishSave!: () => void;
    let current = true;
    const pending = createFamilySkiCircle(input, 'old-user', {
      createCircle: async () => '30000000-0000-0000-0000-000000000001',
      verifyOwner: async () => true,
      savePrivateBrief: () => new Promise<void>((resolve) => { finishSave = resolve; }),
      isCurrent: () => current,
    });
    await vi.waitFor(() => expect(finishSave).toBeTypeOf('function'));
    current = false;
    finishSave();
    expect(await pending).toEqual({ kind: 'stale' });
  });

  it('does not surface a failed private brief to the next account after sign-out', async () => {
    let failSave!: (error: Error) => void;
    let current = true;
    const pending = createFamilySkiCircle(input, 'old-user', {
      createCircle: async () => '30000000-0000-0000-0000-000000000001',
      verifyOwner: async () => true,
      savePrivateBrief: () => new Promise<void>((_resolve, reject) => { failSave = reject; }),
      isCurrent: () => current,
    });
    await vi.waitFor(() => expect(failSave).toBeTypeOf('function'));
    current = false;
    failSave(new Error('message write failed'));
    expect(await pending).toEqual({ kind: 'stale' });
  });
});
