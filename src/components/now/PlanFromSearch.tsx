'use client';

import { useState, type FormEvent } from 'react';
import { memberFetch } from '@/lib/platform/memberFetch';
import { usePlanFrom, type PlanFrom } from '@/lib/now/planFrom';
import styles from './plan-from.module.css';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'done'; places: PlanFrom[] } | { status: 'error'; message: string; signIn?: boolean };

/**
 * "Where are you staying?": type a hotel or an address, pick it, and Now
 * plans the night from there. The search goes to Google Places through our
 * server, which keeps none of it; the pick is saved on this device.
 */
export function PlanFromSearch({ onPicked, autoFocus = false }: { onPicked?: (place: PlanFrom) => void; autoFocus?: boolean }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const set = usePlanFrom((s) => s.set);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 3) return;
    setState({ status: 'loading' });
    try {
      const response = await memberFetch('/api/now/where', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: text }) });
      const body = (await response.json().catch(() => ({}))) as { places?: PlanFrom[]; error?: string; code?: string };
      if (!response.ok) {
        const signIn = response.status === 401 || body.code === 'SIGN_IN_REQUIRED' || body.code === 'MEMBERS_ONLY';
        setState({ status: 'error', signIn, message: signIn ? 'Planning from a hotel is for members. Log in to search.' : body.error ?? 'Search didn’t work. Try again shortly.' });
        return;
      }
      setState({ status: 'done', places: body.places ?? [] });
    } catch {
      setState({ status: 'error', message: 'Search didn’t work. Check your connection and try again.' });
    }
  };

  const pick = (place: PlanFrom) => {
    set(place);
    setQuery('');
    setState({ status: 'idle' });
    onPicked?.(place);
  };

  return (
    <div className={styles.root}>
      <form className={styles.form} onSubmit={search} role="search" aria-label="Plan from a hotel or address">
        <input
          className={styles.input}
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, 120))}
          placeholder="Hotel name or address"
          aria-label="Hotel name or address"
          autoComplete="street-address"
          enterKeyHint="search"
          autoFocus={autoFocus}
        />
        <button type="submit" className={styles.go} disabled={query.trim().length < 3 || state.status === 'loading'}>
          {state.status === 'loading' ? 'Finding…' : 'Find'}
        </button>
      </form>
      {state.status === 'error' ? (
        <p className={styles.note} role="status">
          {state.message}
          {state.signIn ? <> <a href="/login?next=%2Fnow">Log in</a></> : null}
        </p>
      ) : null}
      {state.status === 'done' ? (
        state.places.length ? (
          <ul className={styles.results} aria-label="Places found">
            {state.places.map((place) => (
              <li key={`${place.lat},${place.lng}`}>
                <button type="button" className={styles.result} onClick={() => pick(place)}>
                  <strong>{place.name}</strong>
                  <small>{place.address}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.note} role="status">Nothing found. Try the hotel’s full name with its town, or a street address.</p>
        )
      ) : null}
      <p className={styles.privacy}>Searched with Google Places. Our server remembers a search for a day at most, never tied to you. The place you pick stays on this device.</p>
    </div>
  );
}
