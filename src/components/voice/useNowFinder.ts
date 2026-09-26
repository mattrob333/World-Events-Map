'use client';

import { memberFetch } from '@/lib/platform/memberFetch';
import { useCallback, useRef, useState } from 'react';
import { pickActiveProfile, useDesignerStore } from '@/lib/designer/store';
import { PULSE_WHATS, roundForSearch, type PulseResult, type PulseWhat } from '@/lib/now/pulse';
import { picksSummary, rankNowPicks, type NowEnergy, type NowPick } from '@/lib/now/nowPicks';
import { allSignals } from '@/lib/vibe/signals';

export type NowAsk = { what: PulseWhat; energy: NowEnergy; where?: string; late?: boolean };
export type NowFound =
  | { status: 'idle' }
  | { status: 'loading'; ask: NowAsk }
  | { status: 'ready'; ask: NowAsk; picks: NowPick[]; place: string; basis: 'live' | 'forecast' | 'mixed' }
  | { status: 'error'; ask: NowAsk; message: string };

const ENERGIES: NowEnergy[] = ['chill', 'social', 'lively', 'surprise'];
const NEAR_RADIUS = 3219; // two miles

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function devicePosition(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 120_000 },
    );
  });
}

/** "the mood for a bar" is not a place; "a wedding in Austin" is Austin. */
function placeFrom(raw: string | undefined): { where?: string } {
  if (!raw) return {};
  let where = raw;
  if (/^(?:a|an|the|my|our)\s/i.test(where)) {
    const inner = /\s(?:in|near|around)\s+(.+)$/i.exec(where)?.[1];
    if (!inner) return {};
    where = inner;
  }
  if (/^(?:home|work|the office|bed|the mood)\b/i.test(where) || where.length <= 2) return {};
  return { where };
}

/** Reads a typed or dictated ask ("I'm in Flushing, want a late bar with a crowd"). */
export function askFromText(text: string): NowAsk {
  const t = text.toLowerCase();
  const what: PulseWhat = /\b(bar|bars|drink|drinks|cocktail|beer|wine|pub)\b/.test(t) ? 'drinks'
    : /\b(eat|food|bite|dinner|restaurant|pizza|taco|tacos|ramen|burger)\b/.test(t) ? 'food'
    : /\b(music|live|jazz|club|dance|dancing|dj|karaoke)\b/.test(t) ? 'music'
    : /\b(something to do|museum|gallery|show)\b/.test(t) ? 'experience' : 'surprise';
  // "not too busy", "no crowds" mean quiet, not lively.
  const unnegated = t.replace(/\b(?:not|no|never|isn'?t|without)\s+(?:too\s+|very\s+|that\s+|super\s+|a\s+)?(?:busy|packed|crowds?|crowded|loud|lively|buzzing|popping)\b/g, ' quiet ');
  const energy: NowEnergy = /\b(busy|packed|crowd|crowded|foot traffic|lively|loud|buzzing|popping)\b/.test(unnegated) ? 'lively'
    : /\b(chill|quiet|low.?key|calm|mellow)\b/.test(unnegated) ? 'chill' : 'social';
  const late = /\b(late|after midnight|all night|stays open|open till|last call)\b/.test(t);
  const plain = text.replace(/[’‘]/g, "'");
  const CLAUSE = "(?:and|but|so|looking|want|wanna|need|trying|it'?s|what|where|any|at\\s+\\d)";
  const found = new RegExp(
    `\\b(?:i'?m|we'?re|i am|we are)\\s+(?:(?:over\\s+)?(?:here\\s+)?(?:in|at|near|around))\\s+([a-z0-9' -]+?(?:,(?!\\s*${CLAUSE}\\b)\\s*[a-z' -]+?)?)(?=[.!?]|,?\\s+${CLAUSE}\\b|,\\s*${CLAUSE}\\b|$)`,
    'i',
  ).exec(plain)?.[1]?.trim();
  return { what, energy, late, ...placeFrom(found) };
}

/**
 * Vibe Now's search: where they are (their phone, or a place they named),
 * what's open and busy there from BestTime, ranked on this device against
 * their Vibe profile. The server sees a point rounded to about a kilometer.
 */
export function useNowFinder() {
  const [found, setFound] = useState<NowFound>({ status: 'idle' });
  const run = useRef(0);

  const find = useCallback(async (raw: Partial<NowAsk>): Promise<string> => {
    const ask: NowAsk = {
      what: PULSE_WHATS.includes(raw.what as PulseWhat) ? (raw.what as PulseWhat) : 'surprise',
      energy: ENERGIES.includes(raw.energy as NowEnergy) ? (raw.energy as NowEnergy) : 'social',
      where: typeof raw.where === 'string' && raw.where.trim() ? raw.where.trim().slice(0, 80) : undefined,
      late: raw.late === true,
    };
    const mine = ++run.current;
    setFound({ status: 'loading', ask });
    const fail = (message: string) => {
      if (mine === run.current) setFound({ status: 'error', ask, message });
      return `Error: ${message}`;
    };

    let point: { lat: number; lng: number } | null = null;
    let place = 'you';
    if (ask.where) {
      const response = await memberFetch(`/api/geo/lookup?q=${encodeURIComponent(ask.where)}`).catch(() => null);
      const body = response?.ok ? ((await response.json()) as { place?: { lat: number; lng: number; label: string } | null }) : null;
      if (!body?.place) return fail(`Couldn’t find “${ask.where}” on the map. Try a neighborhood and city.`);
      point = body.place;
      place = body.place.label;
    } else {
      point = await devicePosition();
      if (!point) return fail('Location is off. Allow it for this site, or say where you are.');
    }

    const response = await memberFetch('/api/now/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: roundForSearch(point), what: ask.what, radiusMeters: NEAR_RADIUS }),
    }).catch(() => null);
    const body = response ? ((await response.json().catch(() => ({}))) as Partial<PulseResult> & { code?: string; error?: string }) : null;
    if (!response || !response.ok) {
      return fail(body?.code === 'NOW_PROVIDER_NOT_CONFIGURED' ? 'Foot traffic isn’t connected yet, so I can’t see what’s busy.' : body?.error ?? 'Foot traffic could not be checked. Try again shortly.');
    }
    const here = point;
    const venues = (body?.venues ?? []).map((venue) => ({ ...venue, distanceMeters: Math.round(metersBetween(here, venue)) }));
    const { profiles, activeProfileId } = useDesignerStore.getState();
    const saved = pickActiveProfile(profiles, activeProfileId)?.profile;
    const now = new Date();
    const picks = rankNowPicks(venues, { energy: ask.energy, late: ask.late, nowMinutes: now.getHours() * 60 + now.getMinutes(), signals: saved ? allSignals(saved) : [], dials: saved?.dials });
    const kinds = new Set(picks.map((pick) => pick.basis));
    if (mine === run.current) setFound({ status: 'ready', ask, picks, place, basis: kinds.size > 1 ? 'mixed' : kinds.has('live') ? 'live' : 'forecast' });
    return picksSummary(picks, place === 'you' ? 'them' : place);
  }, []);

  const reset = useCallback(() => {
    run.current += 1;
    setFound({ status: 'idle' });
  }, []);

  return { found, find, reset };
}
