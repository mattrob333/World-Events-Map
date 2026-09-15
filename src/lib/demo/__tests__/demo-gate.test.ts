import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '@/lib/social/__tests__/storage';

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('demo world boundary', () => {
  it('exposes the existing deterministic simulation only with demo on', async () => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '1');
    const { getDemoWorld, isDemo } = await import('@/lib/demo');
    const { getSimulation } = await import('@/lib/social/simulation');
    const { getThreads } = await import('@/lib/social/chat');
    const world = getDemoWorld();
    expect(isDemo()).toBe(true);
    expect(world.members.length).toBeGreaterThan(1);
    expect(world.signals.length).toBeGreaterThan(0);
    expect(world.groups.length).toBeGreaterThan(0);
    expect(world.signals).toBe(getSimulation().signals);
    expect(world.groups).toBe(getSimulation().groups);
    expect(getDemoWorld()).toBe(world);
    expect(getThreads().size).toBeGreaterThan(0);
  });

  it('keeps only the current user and empties every simulated collection with demo off', async () => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '0');
    const simulation = await import('@/lib/social/simulation');
    const getSimulation = vi.spyOn(simulation, 'getSimulation');
    const { getDemoWorld } = await import('@/lib/demo');
    const { getMember, resolveVoucher, YOU } = await import('@/lib/social/members');
    const { getThreads } = await import('@/lib/social/chat');
    const { isOnline, typingIn, getPresenceTick } = await import('@/lib/social/presence');
    const { buildActivityFeed } = await import('@/lib/social/notifications');
    const world = getDemoWorld();
    expect(world.currentMember).toBe(YOU);
    expect(world.members).toEqual([YOU]);
    expect([...world.memberIndex.values()]).toEqual([YOU]);
    expect(world.signals).toEqual([]);
    expect(world.signalsByEvent.size).toBe(0);
    expect(world.peerCounts).toEqual({});
    expect(world.groups).toEqual([]);
    expect(world.groupsByEvent.size).toBe(0);
    expect(world.dripQueue).toEqual([]);
    expect(getThreads().size).toBe(0);
    expect(getPresenceTick()).toBe(0);
    expect(isOnline('m-avroche', 100)).toBe(false);
    expect(isOnline(YOU.id, 100)).toBe(false);
    expect(typingIn('grp-monaco-grand-prix-1', ['m-avroche'], 100)).toBeNull();
    expect(getMember('m-avroche')).toBeUndefined();
    expect(resolveVoucher(YOU.verifiedBy)).toBeUndefined();
    expect(buildActivityFeed({
      currentMemberId: YOU.id, interests: [], groups: [], dripRevealed: 100, readIds: [],
    })).toEqual([]);
    expect(getSimulation).not.toHaveBeenCalled();
    expect(getDemoWorld()).toBe(world);
  });

  it('does not reuse warmed demo counts or threads after the boundary closes', async () => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '1');
    const { getDemoWorld } = await import('@/lib/demo');
    const { computePeerCounts } = await import('@/lib/social/simulation');
    const { getThreads } = await import('@/lib/social/chat');
    expect(Object.keys(computePeerCounts(5)).length).toBeGreaterThan(0);
    expect(getThreads().size).toBeGreaterThan(0);
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '0');
    expect(getDemoWorld().groups).toEqual([]);
    expect(computePeerCounts(5)).toEqual({});
    expect(getThreads().size).toBe(0);
  });
});
