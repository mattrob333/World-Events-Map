'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { PlatformShell } from '@/components/community/PlatformShell';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import type { NowIntent, NowResult, NowVibe } from '@/lib/now/types';
import styles from './now.module.css';

const INTENTS: { value: NowIntent; label: string; note: string }[] = [
  { value: 'food', label: 'Eat', note: 'restaurant or food' },
  { value: 'drinks', label: 'Drinks', note: 'bar, cocktail, brewery' },
  { value: 'music', label: 'Music', note: 'live sound or nightlife' },
  { value: 'experience', label: 'Do something', note: 'culture, markets, attractions' },
  { value: 'surprise', label: 'Surprise me', note: 'open the aperture' },
];

const VIBES: { value: NowVibe; label: string }[] = [
  { value: 'chill', label: 'Chill' },
  { value: 'social', label: 'Social' },
  { value: 'lively', label: 'Lively' },
  { value: 'surprise', label: 'Surprise me' },
];

const PICK_LABEL = {
  best_match: 'Best Match',
  most_alive: 'Most Alive',
  wildcard: 'Wildcard',
} as const;

type TravelModeOption = {
  id: string;
  name: string;
  interests: string[];
};

function formatDistance(meters?: number) {
  if (meters === undefined) return 'distance unknown';
  return meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
}

function formatBusyness(live?: number, expected?: number) {
  if (live !== undefined) return `${Math.round(live)}% busy live`;
  if (expected !== undefined) return `${Math.round(expected)}% expected now`;
  return 'traffic signal unavailable';
}

function mapHref(lat: number, lng: number, name: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${lat},${lng}`)}`;
}

export function NowExperience() {
  const { client, user } = usePlatformAuth();
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [intent, setIntent] = useState<NowIntent>('drinks');
  const [vibe, setVibe] = useState<NowVibe>('social');
  const [radiusMeters, setRadiusMeters] = useState(3000);
  const [availableMinutes, setAvailableMinutes] = useState(180);
  const [partySize, setPartySize] = useState(1);
  const [maxPriceLevel, setMaxPriceLevel] = useState(4);
  const [modes, setModes] = useState<TravelModeOption[]>([]);
  const [selectedModeId, setSelectedModeId] = useState('');
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<NowResult | null>(null);

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void Promise.all([
      client
        .from('travel_modes')
        .select('id,name')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      client.from('travel_mode_interests').select('mode_id,interest,weight'),
    ]).then(([modeResult, interestResult]) => {
      if (!active || modeResult.error || interestResult.error) return;
      const interestMap = new Map<string, string[]>();
      for (const row of interestResult.data ?? []) {
        const list = interestMap.get(row.mode_id) ?? [];
        list.push(row.interest);
        interestMap.set(row.mode_id, list);
      }
      const next = (modeResult.data ?? []).map((mode) => ({
        id: mode.id,
        name: mode.name,
        interests: interestMap.get(mode.id) ?? [],
      }));
      setModes(next);
      if (next.length) setSelectedModeId((current) => current || next[0].id);
    });
    return () => {
      active = false;
    };
  }, [client, user]);

  const visibleModes = user ? modes : [];
  const selectedMode = useMemo(
    () => visibleModes.find((mode) => mode.id === selectedModeId),
    [visibleModes, selectedModeId],
  );

  function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('This browser cannot share location. Enter latitude and longitude manually.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(5));
        setLng(position.coords.longitude.toFixed(5));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('Location access was not available. Enter latitude and longitude manually.');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      setError('Use your location or enter valid coordinates first.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: { lat: parsedLat, lng: parsedLng },
          intent,
          vibe,
          radiusMeters,
          availableMinutes,
          partySize,
          maxPriceLevel,
          minRating: 4,
          travelModeName: selectedMode?.name,
          interests: selectedMode?.interests,
        }),
      });
      const payload = (await response.json()) as NowResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || 'NOW could not complete the request.');
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'NOW could not complete the request.');
    } finally {
      setLoading(false);
    }
  }

  const hasModes = visibleModes.length > 0;

  return (
    <PlatformShell
      eyebrow="NOW · local decision engine"
      title="Where should we go right now?"
      description="Give MERIDIAN the moment you are actually in. It filters what is viable, reads the local energy, and gives you three decisions instead of another directory."
    >
      <div className={styles.layout}>
        <form className={styles.controls} onSubmit={submit}>
          <section className={styles.block}>
            <span className={styles.kicker}>01 · Where you are</span>
            <button type="button" className={styles.primary} onClick={locate} disabled={locating}>
              {locating ? 'Finding you…' : lat && lng ? 'Refresh my location' : 'Use my location'}
            </button>
            <p className={styles.privacy}>Your precise location is used for this decision and is not written to your member profile.</p>
            <details className={styles.manual}>
              <summary>Enter coordinates instead</summary>
              <div className={styles.twoCol}>
                <label>Latitude<input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.7580" /></label>
                <label>Longitude<input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-73.9855" /></label>
              </div>
            </details>
          </section>

          {hasModes && (
            <section className={styles.block}>
              <span className={styles.kicker}>02 · Who you are tonight</span>
              <select value={selectedModeId} onChange={(e) => setSelectedModeId(e.target.value)}>
                <option value="">No travel mode</option>
                {visibleModes.map((mode) => <option key={mode.id} value={mode.id}>{mode.name}</option>)}
              </select>
              {selectedMode?.interests.length ? <p className={styles.context}>{selectedMode.interests.join(' · ')}</p> : null}
            </section>
          )}

          <section className={styles.block}>
            <span className={styles.kicker}>{hasModes ? '03' : '02'} · What you want</span>
            <div className={styles.choiceGrid}>
              {INTENTS.map((option) => (
                <button key={option.value} type="button" className={intent === option.value ? styles.selected : styles.choice} onClick={() => setIntent(option.value)}>
                  <strong>{option.label}</strong><span>{option.note}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <span className={styles.kicker}>{hasModes ? '04' : '03'} · Vibe</span>
            <div className={styles.pills}>
              {VIBES.map((option) => (
                <button key={option.value} type="button" className={vibe === option.value ? styles.pillSelected : styles.pill} onClick={() => setVibe(option.value)}>{option.label}</button>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <span className={styles.kicker}>{hasModes ? '05' : '04'} · Constraints</span>
            <div className={styles.twoCol}>
              <label>Search radius<select value={radiusMeters} onChange={(e) => setRadiusMeters(Number(e.target.value))}><option value={1000}>1 km</option><option value={3000}>3 km</option><option value={5000}>5 km</option><option value={10000}>10 km</option></select></label>
              <label>Time available<select value={availableMinutes} onChange={(e) => setAvailableMinutes(Number(e.target.value))}><option value={90}>90 min</option><option value={180}>3 hours</option><option value={360}>6 hours</option><option value={720}>All day / night</option></select></label>
              <label>Party size<input type="number" min={1} max={20} value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} /></label>
              <label>Max price<select value={maxPriceLevel} onChange={(e) => setMaxPriceLevel(Number(e.target.value))}><option value={2}>$$</option><option value={3}>$$$</option><option value={4}>$$$$</option><option value={5}>No limit</option></select></label>
            </div>
          </section>

          <button className={styles.go} disabled={loading || !lat || !lng}>{loading ? 'Reading the room…' : 'Find my next move'}</button>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>

        <section className={styles.results} aria-live="polite">
          {!result && !loading && (
            <div className={styles.empty}>
              <span className={styles.kicker}>Decision, not search</span>
              <h2>Three answers. Different reasons.</h2>
              <p>Best Match optimizes for your whole context. Most Alive prioritizes local energy. Wildcard deliberately keeps one strong option outside the obvious lane.</p>
            </div>
          )}
          {loading && <div className={styles.empty}><span className={styles.pulse} /><h2>Reading what is viable now.</h2><p>Checking local venues, hard constraints and the context you gave MERIDIAN.</p></div>}
          {result && (
            <>
              <div className={styles.resultHeader}>
                <div><span className={styles.kicker}>NOW read</span><h2>{result.picks.length ? 'Go make the night happen.' : 'Nothing cleanly fits yet.'}</h2></div>
                <span className={styles.meta}>{result.candidateCount} viable candidates</span>
              </div>
              <div className={styles.cards}>
                {result.picks.map((pick) => (
                  <article key={pick.label} className={styles.pick}>
                    <div className={styles.pickTop}><span className={styles.pickLabel}>{PICK_LABEL[pick.label]}</span><span className={styles.score}>{Math.round(pick.score)}</span></div>
                    <h3>{pick.candidate.name}</h3>
                    <p className={styles.category}>{pick.candidate.category.replaceAll('_', ' ')}</p>
                    <div className={styles.facts}>
                      <span>{formatBusyness(pick.candidate.liveBusyness, pick.candidate.expectedBusyness)}</span>
                      <span>{formatDistance(pick.candidate.distanceMeters)}</span>
                      {pick.candidate.rating !== undefined && <span>{pick.candidate.rating.toFixed(1)} ★</span>}
                      {pick.candidate.priceLevel !== undefined && <span>{'$'.repeat(Math.max(1, Math.round(pick.candidate.priceLevel)))}</span>}
                    </div>
                    {pick.reasons.length > 0 && <ul>{pick.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
                    <a className={styles.mapLink} href={mapHref(pick.candidate.location.lat, pick.candidate.location.lng, pick.candidate.name)} target="_blank" rel="noreferrer">Open in maps ↗</a>
                  </article>
                ))}
              </div>
              {result.warnings.length > 0 && <div className={styles.warnings}>{result.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
              <p className={styles.source}>Venue facts: {result.venueSource}. Judgment: {result.judgmentSource}. MERIDIAN does not imply reservations or availability.</p>
            </>
          )}
        </section>
      </div>
    </PlatformShell>
  );
}
