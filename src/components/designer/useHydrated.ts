'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true after: gates device-local state. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
