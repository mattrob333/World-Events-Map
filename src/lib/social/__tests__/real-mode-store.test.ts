import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_INDEX } from '@/lib/data/events';
import { memoryStorage } from './storage';

const EVENT_IDS = ['monaco-grand-prix', 'art-basel-basel', 'wimbledon'];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '0');
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('social store with demo off', () => {
  it.each(EVENT_IDS)('returns no simulated activity for %s', async (eventId) => {
    const { getPeerCounts, useSocialStore } = await import('@/lib/social');
    const state = useSocialStore.getState();
    expect(EVENT_INDEX.has(eventId)).toBe(true);
    expect(getPeerCounts()).toEqual({});
    expect(state.peerCountFor(eventId)).toBe(0);
    expect(state.peerSignalsFor(eventId)).toEqual([]);
    expect(state.membersInterestedIn(eventId)).toEqual([]);
    expect(state.groupsFor(eventId)).toEqual([]);
    expect(state.messagesFor(`grp-${eventId}-1`)).toEqual([]);
    expect(state.unreadFor(`grp-${eventId}-1`)).toBe(0);
  });

  it('keeps a user-created group and a user-authored message without inventing replies', async () => {
    const { useSocialStore, JETS, buildActivityFeed } = await import('@/lib/social');
    const group = useSocialStore.getState().createGroup(EVENT_IDS[0], 'Planning a weekend away', 8)!;
    expect(group).not.toBeNull();
    const message = useSocialStore.getState().sendMessage(group.id, 'Thursday is my preference.');
    useSocialStore.getState().chooseJet(group.id, JETS[0]);
    const state = useSocialStore.getState();
    expect(state.groupsFor(EVENT_IDS[0]).map((g) => g.id)).toEqual([group.id]);
    expect(state.myGroupFor(EVENT_IDS[0])?.id).toBe(group.id);
    expect(state.isInGroup(group.id)).toBe(true);
    expect(state.messagesFor(group.id)).toEqual([message]);
    expect(state.interestFor(EVENT_IDS[0])).toBe('committed');
    expect(state.peerCountFor(EVENT_IDS[0])).toBe(0);
    expect(state.unreadFor(group.id)).toBe(0);
    expect(buildActivityFeed({
      currentMemberId: state.currentMember.id, interests: state.interests,
      groups: state.groups, dripRevealed: 999, readIds: [],
    })).toEqual([]);
  });

  it('never invokes startDrip from SocialLive or presence in real mode', async () => {
    vi.useFakeTimers();
    const simulation = await import('@/lib/social/simulation');
    const startDrip = vi.spyOn(simulation, 'startDrip');
    const { startSocialLive } = await import('@/components/social/SocialLive');
    const presence = await import('@/lib/social/presence');
    const { useSocialStore } = await import('@/lib/social/useSocialStore');
    expect(startSocialLive({ hydrated: true, minMs: 1, maxMs: 1 })).toBeUndefined();
    const onPresence = vi.fn();
    const unsubscribe = presence.subscribePresence(onPresence);
    presence.setPresencePaused(true);
    presence.setPresencePaused(false);
    vi.advanceTimersByTime(60_000);
    expect(startDrip).not.toHaveBeenCalled();
    expect(onPresence).not.toHaveBeenCalled();
    expect(presence.getPresenceTick()).toBe(0);
    expect(useSocialStore.getState().dripRevealed).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    unsubscribe();
  });

  it('does not schedule even a direct startDrip call in real mode', async () => {
    vi.useFakeTimers();
    const { startDrip } = await import('@/lib/social/simulation');
    const onTick = vi.fn();
    const controller = startDrip(onTick, { minMs: 1, maxMs: 1 });
    vi.advanceTimersByTime(100);
    expect(onTick).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    controller.stop();
  });
});

describe('social store with demo on', () => {
  it.each(EVENT_IDS)('retains simulated peers, groups and threads for %s', async (eventId) => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '1');
    const { getPeerCounts, useSocialStore } = await import('@/lib/social');
    const state = useSocialStore.getState();
    expect(getPeerCounts()[eventId]).toBeGreaterThan(0);
    expect(state.peerCountFor(eventId)).toBeGreaterThan(0);
    expect(state.membersInterestedIn(eventId).length).toBeGreaterThan(0);
    expect(state.groupsFor(eventId).length).toBeGreaterThan(0);
    expect(state.messagesFor(`grp-${eventId}-1`).length).toBeGreaterThan(0);
  });

  it('runs and cleans up the social and presence timers in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '1');
    vi.useFakeTimers();
    const simulation = await import('@/lib/social/simulation');
    const startDrip = vi.spyOn(simulation, 'startDrip');
    const { startSocialLive } = await import('@/components/social/SocialLive');
    const presence = await import('@/lib/social/presence');
    const { useSocialStore } = await import('@/lib/social/useSocialStore');
    const stop = startSocialLive({ hydrated: true, minMs: 100, maxMs: 100 });
    const unsubscribe = presence.subscribePresence(vi.fn());
    expect(startDrip).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(7_000);
    expect(useSocialStore.getState().dripRevealed).toBeGreaterThan(0);
    expect(presence.getPresenceTick()).toBeGreaterThan(0);
    stop?.();
    unsubscribe();
    expect(vi.getTimerCount()).toBe(0);
  });
});
