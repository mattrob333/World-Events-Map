'use client';

import { useEffect, useState } from 'react';
import type { Activity } from '@/lib/activity/activities';
import type { Conditions, Units } from '@/lib/activity/conditions/types';
import { useActiveProfile } from '@/lib/designer/store';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

export type { Units };
export type LiveConditions = Conditions;

export type ConditionsState =
  | { status: 'loading' }
  | { status: 'ready'; data: LiveConditions }
  | { status: 'empty' }
  | { status: 'offline' };

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const first = window.setTimeout(() => setOnline(navigator.onLine), 0);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

/**
 * Live conditions for the open card, from our own server route (which calls
 * Open-Meteo and NOAA and caches at the edge). The browser never calls a
 * weather provider. Profile events have no route: they're listings, handled
 * by the card itself.
 */
export function useConditions(a: Activity | null, units: Units): ConditionsState {
  const online = useOnline();
  const [state, setState] = useState<{ key: string; value: ConditionsState } | null>(null);
  // Keyed on the id: the same spot can arrive as a new object (a heat update) and must not refetch.
  const id = a && a.source !== 'profile' ? a.id : null;
  const key = id ? `${id}:${units}:${online}` : '';
  useEffect(() => {
    if (!id || !online) return;
    const controller = new AbortController();
    fetch(`/api/activity-conditions?id=${encodeURIComponent(id)}&units=${units}`, { signal: controller.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as { conditions: LiveConditions | null }) : { conditions: null }))
      .then((body) => setState({ key, value: body.conditions ? { status: 'ready', data: body.conditions } : { status: 'empty' } }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, value: { status: navigator.onLine ? 'empty' : 'offline' } });
      });
    return () => controller.abort();
  }, [id, units, online, key]);
  if (!a || a.source === 'profile') return { status: 'empty' };
  if (!online) return { status: 'offline' };
  return state?.key === key ? state.value : { status: 'loading' };
}

/**
 * The traveler's home airport, for flight links: their traveler profile's,
 * else the one in Settings. Stays on the device except for the member's own
 * profile read.
 */
export function useHomeAirport(): string | undefined {
  const active = useActiveProfile();
  const fromProfile = active?.profile.style?.homeAirport;
  const { client, user } = usePlatformAuth();
  const [fromAccount, setFromAccount] = useState<string | undefined>();
  useEffect(() => {
    if (fromProfile || !client || !user) return;
    let live = true;
    void client.from('profiles').select('home_airport').eq('id', user.id).maybeSingle().then(({ data }) => {
      const code = typeof data?.home_airport === 'string' ? data.home_airport.trim().toUpperCase() : '';
      if (live && /^[A-Z]{3,4}$/.test(code)) setFromAccount(code);
    });
    return () => { live = false; };
  }, [client, user, fromProfile]);
  return fromProfile || fromAccount;
}
