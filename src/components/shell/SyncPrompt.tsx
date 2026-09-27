'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { useDesignerStore } from '@/lib/designer/store';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

const KEY = 'dope.syncPrompt.v1';

function asked(userId: string): boolean {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(list) && list.includes(userId);
  } catch {
    return true;
  }
}

function remember(userId: string) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    const ids = Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : [];
    localStorage.setItem(KEY, JSON.stringify([...new Set([...ids, userId])].slice(-10)));
  } catch {
    // Storage blocked: the prompt may show again next visit, which is harmless.
  }
}

/**
 * Asked once per account on this device, after sign-in: keep travelers,
 * groups and trips with the account? Saving stays off unless they say yes
 * (Settings can change it any time). Never shown on a device whose data
 * belongs to another account; Settings handles that case.
 */
export function SyncPrompt() {
  const hydrated = useHydrated();
  const pathname = usePathname() ?? '';
  // Asked where their travelers, groups and trips live (You, Trips), never over the globe on first open.
  const onTheirStuff = pathname.startsWith('/vibe') || pathname.startsWith('/trips');
  const { user } = usePlatformAuth();
  const accountSync = useDesignerStore((state) => state.accountSync);
  const owner = useDesignerStore((state) => state.syncOwner);
  const travelers = useDesignerStore((state) => state.profiles.length);
  const trips = useDesignerStore((state) => (state.trip ? 1 : 0) + (state.previousTrip ? 1 : 0));
  const setAccountSync = useDesignerStore((state) => state.setAccountSync);
  const claimDevice = useDesignerStore((state) => state.claimDevice);
  const [answered, setAnswered] = useState<string | null>(null);
  const userId = user?.id ?? null;
  // Read after hydration only, so the server render and the first client render agree.
  const show = hydrated && onTheirStuff && Boolean(userId) && answered !== userId && !accountSync && !(owner && owner !== userId) && !asked(userId!);
  if (!show || !userId) return null;
  // "your traveler profile and groups", "your 3 traveler profiles, groups and trip"
  const parts = [
    travelers === 1 ? 'traveler profile' : travelers > 1 ? `${travelers} traveler profiles` : 'traveler profiles',
    'groups',
    ...(trips === 1 ? ['trip'] : trips > 1 ? ['trips'] : []),
  ];
  const what = `your ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]}`;

  function answer(yes: boolean) {
    if (!userId) return;
    remember(userId);
    // Either way this device's data is now theirs: another account signing in here later
    // is sent to Settings' "belongs to another account" path, never offered this upload.
    if (yes) setAccountSync(true, userId);
    else claimDevice(userId);
    setAnswered(userId);
  }

  return (
    <div role="dialog" aria-labelledby="sync-prompt-title" className="surface fixed inset-x-3 bottom-[calc(96px+env(safe-area-inset-bottom))] z-50 grid gap-2 p-4 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-96">
      <p id="sync-prompt-title" className="text-[15px] font-semibold text-bone">Keep {what} with your account?</p>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Then they follow you to any device you sign in on. Only you can see them. You can turn this off in Settings, which removes them from your account.
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => answer(true)}>Keep them with my account</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => answer(false)}>Not now</button>
      </div>
    </div>
  );
}
