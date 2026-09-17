'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getPlatformClient } from './client';

export function usePlatformAuth() {
  const [client] = useState(getPlatformClient);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(client));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!client) return;
    let active = true;
    let authChanged = false;
    void client.auth.getUser().then(({ data, error: authError }) => {
      if (!active || authChanged) return;
      setUser(data.user);
      if (authError && authError.name !== 'AuthSessionMissingError')
        setError(authError.message);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      authChanged = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  async function signIn(email: string) {
    if (!client) throw new Error('Member services are not configured yet.');
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          window.location.origin +
          window.location.pathname +
          window.location.search,
      },
    });
    if (error) throw error;
  }
  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setUser(null);
  }
  return { client, user, loading, error, signIn, signOut };
}
