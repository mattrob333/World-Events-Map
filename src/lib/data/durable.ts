import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { BuzzSignals } from '@/lib/types';

export interface SignalSnapshot {
  event_id: string;
  patch: Partial<BuzzSignals>;
  fetched_at: string;
}
export function signalDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key
    ? createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}

export async function readSnapshots(ttlMs: number): Promise<SignalSnapshot[]> {
  const db = signalDatabase();
  if (!db) return [];
  const { data, error } = await db
    .from('meridian_signal_snapshots')
    .select('event_id,patch,fetched_at')
    .gte('fetched_at', new Date(Date.now() - ttlMs).toISOString());
  if (error)
    throw new Error(
      'Signal storage is unavailable; check the live-signals migration',
    );
  return data ?? [];
}

export async function persistSnapshots(rows: SignalSnapshot[]) {
  const db = signalDatabase();
  if (!db || !rows.length) return;
  const { error } = await db
    .from('meridian_signal_snapshots')
    .upsert(rows, { onConflict: 'event_id' });
  if (error) throw new Error('Could not persist refreshed signals');
}
