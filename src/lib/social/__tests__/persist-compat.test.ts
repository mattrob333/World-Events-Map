import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from './storage';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-15T12:00:00Z'));
  vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '1');
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('persist v4 compatibility across the demo boundary', () => {
  it('hydrates every user delta unchanged with demo off, including drafts in hidden demo threads', async () => {
    const { useSocialStore: demoStore } = await import('@/lib/social/useSocialStore');
    const { JETS } = await import('@/lib/social/charter');
    const initial = demoStore.getState();
    initial.updateProfile({ name: 'Alex Example', bio: 'My local travel plans', photoUrl: 'data:image/png;base64,YQ==' });
    initial.setInterest('wimbledon', 'interested', 'A weekend with friends');
    const group = initial.createGroup('monaco-grand-prix', 'Thursday out, Sunday home', 8)!;
    initial.chooseJet(group.id, JETS[0]);
    initial.sendMessage(group.id, 'My aircraft preference is flexible.');
    const simulatedGroup = initial.groups.find((g) => g.status !== 'locked' && g.members.length < g.capacity)!;
    initial.joinGroup(simulatedGroup.id);
    initial.sendMessage(simulatedGroup.id, 'Keep this draft even outside demo mode.');
    initial.markRead(simulatedGroup.id);
    initial.rememberContacts(['friend@example.com']);
    initial.noteAsks([simulatedGroup.members[0].memberId], simulatedGroup.eventId, simulatedGroup.id);
    initial.markActivityRead(['sig:wimbledon:m-avroche']);
    initial.spendInvites(1);
    initial.revealNextPeer();

    const options = demoStore.persist.getOptions();
    expect(options.version).toBe(4);
    expect(options.name).toBe('meridian.social');
    const payload = options.partialize!(demoStore.getState());
    expect(payload.userGroups).toHaveLength(1);
    expect(payload.joinedGroupIds).toContain(simulatedGroup.id);
    expect(payload.myMessages.every((m) => m.memberId === payload.currentMember.id)).toBe(true);
    localStorage.setItem(options.name!, JSON.stringify({ state: payload, version: 4 }));

    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '0');
    vi.resetModules();
    const storageRead = vi.spyOn(localStorage, 'getItem');
    const { useSocialStore: realStore } = await import('@/lib/social/useSocialStore');
    expect(storageRead).not.toHaveBeenCalled();
    expect(realStore.getState().hydrated).toBe(false);
    expect(realStore.getState().groups).toEqual([]);
    await realStore.persist.rehydrate();

    const state = realStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.currentMember).toEqual(payload.currentMember);
    expect(state.interests).toEqual(payload.interests);
    expect(state.groups).toEqual(payload.userGroups);
    expect(state.myMessages).toEqual(payload.myMessages);
    expect(state.lastReadAt).toEqual(payload.lastReadAt);
    expect(state.contacts).toEqual(payload.contacts);
    expect(state.asks).toEqual(payload.asks);
    expect(state.readActivityIds).toEqual(payload.readActivityIds);
    expect(state.invitesRemaining).toBe(payload.invitesRemaining);
    expect(state.invitesYear).toBe(payload.invitesYear);
    expect(state.dripRevealed).toBe(0);
    expect(state.interests.every((s) => s.memberId === state.currentMember.id)).toBe(true);
    expect(state.groupsFor(simulatedGroup.eventId).every((g) => g.id.startsWith('usr-'))).toBe(true);
    expect(state.messagesFor(simulatedGroup.id)).toEqual(payload.myMessages.filter((m) => m.groupId === simulatedGroup.id));
    expect(state.messagesFor(group.id)).toEqual(payload.myMessages.filter((m) => m.groupId === group.id));
    expect(state.peerCountFor('wimbledon')).toBe(0);
    expect(state.membersInterestedIn('wimbledon')).toEqual([]);
    expect(realStore.persist.getOptions().partialize!(state)).toEqual(payload);

    // An ordinary real-mode write also retains the hidden demo join deltas.
    state.markActivityRead(payload.readActivityIds);
    const saved = JSON.parse(localStorage.getItem(options.name!)!);
    expect(saved).toEqual({ state: payload, version: 4 });

    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '1');
    vi.resetModules();
    const { useSocialStore: restoredDemoStore } = await import('@/lib/social/useSocialStore');
    await restoredDemoStore.persist.rehydrate();
    expect(restoredDemoStore.getState().isInGroup(simulatedGroup.id)).toBe(true);
    expect(restoredDemoStore.getState().myMessages).toEqual(payload.myMessages);
  });

  it.each([1, 2, 3])('still migrates version %s user drafts with demo off', async (version) => {
    const { useSocialStore } = await import('@/lib/social/useSocialStore');
    const state = useSocialStore.getState();
    state.setInterest('wimbledon', 'watching');
    const group = state.createGroup('monaco-grand-prix', 'A saved plan from an older version', 8)!;
    state.sendMessage(group.id, 'A v3 message');
    const options = useSocialStore.persist.getOptions();
    const payload = options.partialize!(useSocialStore.getState());
    const legacy = version === 1 ? { ...payload, groups: useSocialStore.getState().groups } : payload;
    vi.stubEnv('NEXT_PUBLIC_MERIDIAN_DEMO', '0');
    const migrated = await options.migrate!(legacy, version);
    const merged = options.merge!(migrated, useSocialStore.getState());
    expect(merged.currentMember).toEqual(payload.currentMember);
    expect(merged.interests).toEqual(payload.interests);
    expect(merged.groups).toEqual(payload.userGroups);
    expect(merged.myMessages).toEqual(version < 3 ? [] : payload.myMessages);
  });
});
