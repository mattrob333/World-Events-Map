'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { PartyType, TravelModeRecord } from '@/lib/affinity';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import styles from './community.module.css';

const PARTY_TYPES: { value: PartyType; label: string }[] = [
  { value: 'solo', label: 'Solo' },
  { value: 'family', label: 'Family' },
  { value: 'couple', label: 'Couple' },
  { value: 'friends', label: 'Friends' },
  { value: 'work', label: 'Work / layover' },
  { value: 'mixed', label: 'Mixed / flexible' },
];

type ModeWithInterests = TravelModeRecord & { interests: string[] };

export function TravelModesEditor() {
  const { client, user } = usePlatformAuth();
  const [modes, setModes] = useState<ModeWithInterests[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [partyType, setPartyType] = useState<PartyType>('solo');
  const [originCity, setOriginCity] = useState('');
  const [originAirport, setOriginAirport] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [interests, setInterests] = useState('');
  const [discoverable, setDiscoverable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (!client || !user) return;
    const [modeResult, interestResult] = await Promise.all([
      client
        .from('travel_modes')
        .select('id,user_id,name,description,party_type,origin_city,origin_airport,destination,start_date,end_date,visibility')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      client.from('travel_mode_interests').select('mode_id,interest,weight'),
    ]);

    if (modeResult.error) throw modeResult.error;
    if (interestResult.error) throw interestResult.error;

    const interestMap = new Map<string, string[]>();
    for (const item of interestResult.data ?? []) {
      const list = interestMap.get(item.mode_id) ?? [];
      list.push(item.interest);
      interestMap.set(item.mode_id, list);
    }

    setModes(
      (modeResult.data ?? []).map((mode) => ({
        ...(mode as TravelModeRecord),
        interests: interestMap.get(mode.id) ?? [],
      })),
    );
  }, [client, user]);

  useEffect(() => {
    if (!client || !user) return;
    let active = true;
    void refresh().catch((cause) => {
      if (!active) return;
      setError(
        cause instanceof Error
          ? cause.message
          : 'Travel modes could not be loaded. Apply the affinity migration first.',
      );
    });
    return () => {
      active = false;
    };
  }, [client, user, refresh]);

  const cleanInterests = useMemo(
    () => [
      ...new Set(
        interests
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].slice(0, 12),
    [interests],
  );

  if (!user) return null;

  async function createMode(event: FormEvent) {
    event.preventDefault();
    if (!client || !user || !name.trim()) return;

    const invalidInterest = cleanInterests.find((interest) => interest.length > 80);
    if (invalidInterest) {
      setError('Each travel-mode interest must be 80 characters or fewer.');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('Choose an end date on or after the start date.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { error: modeError } = await client.rpc('create_travel_mode', {
        p_name: name.trim(),
        p_description: description.trim(),
        p_party_type: partyType,
        p_origin_city: originCity.trim(),
        p_origin_airport: originAirport.trim().toUpperCase(),
        p_destination: destination.trim(),
        p_start_date: startDate || null,
        p_end_date: endDate || null,
        p_visibility: discoverable ? 'discoverable' : 'private',
        p_interests: cleanInterests,
      });
      if (modeError) throw modeError;

      setName('');
      setDescription('');
      setOriginCity('');
      setOriginAirport('');
      setDestination('');
      setStartDate('');
      setEndDate('');
      setInterests('');
      setDiscoverable(false);
      setNotice('Travel mode created. Switch to Constellation to use it as a matching lens.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Travel mode could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function removeMode(modeId: string) {
    if (!client || !user) return;
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await client
        .from('travel_modes')
        .delete()
        .eq('id', modeId)
        .eq('user_id', user.id);
      if (failure) throw failure;
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Travel mode could not be removed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card}>
      <span className={styles.eyebrow}>Context changes the match</span>
      <h2>Your travel modes</h2>
      <p className={styles.muted}>
        Create different lenses for the different ways you travel. A family ski trip should not
        match the same people or places as a solo layover.
      </p>

      {modes.length > 0 && (
        <div className={styles.list}>
          {modes.map((mode) => (
            <article key={mode.id} className={styles.item}>
              <div className={styles.between}>
                <div>
                  <div className={styles.row}>
                    <strong>{mode.name}</strong>
                    <span className={styles.tag}>{mode.party_type}</span>
                    <span className={styles.tag}>{mode.visibility}</span>
                  </div>
                  <p className={styles.small}>
                    {[mode.origin_city || mode.origin_airport, mode.destination]
                      .filter(Boolean)
                      .join(' -> ') || 'No route preference yet'}
                  </p>
                  {mode.interests.length > 0 && (
                    <p className={styles.small}>{mode.interests.join(' · ')}</p>
                  )}
                </div>
                <button
                  type="button"
                  className={`${styles.button} ${styles.secondary}`}
                  disabled={busy}
                  onClick={() => void removeMode(mode.id)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <form className={styles.form} onSubmit={createMode}>
        <div className={styles.split}>
          <label>
            Mode name
            <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Family Ski" />
          </label>
          <label>
            Traveling as
            <select value={partyType} onChange={(event) => setPartyType(event.target.value as PartyType)}>
              {PARTY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
        </div>
        <label>
          What does this mode mean?
          <textarea maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="School-break ski trips with the family. Good terrain, other families, strong food scene." />
        </label>
        <div className={styles.split}>
          <label>
            Origin city
            <input maxLength={120} value={originCity} onChange={(event) => setOriginCity(event.target.value)} placeholder="Atlanta" />
          </label>
          <label>
            Origin airport
            <input maxLength={4} value={originAirport} onChange={(event) => setOriginAirport(event.target.value.toUpperCase())} placeholder="KATL" />
          </label>
        </div>
        <label>
          Destination intent
          <input maxLength={120} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Aspen, Colorado or leave blank for anywhere" />
        </label>
        <div className={styles.split}>
          <label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label>End date<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>
        <label>
          Interests for this mode
          <input maxLength={400} value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Skiing, family travel, food, mountains" />
          <span className={styles.small}>Separate interests with commas. Up to 12, 80 characters each. New interests start at medium weight.</span>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={discoverable} onChange={(event) => setDiscoverable(event.target.checked)} />
          Let other signed-in members discover this travel mode when my profile is public
        </label>
        <button className={styles.button} disabled={busy}>{busy ? 'Saving…' : 'Create travel mode'}</button>
      </form>

      {notice && <p className={styles.notice}>{notice}</p>}
      {error && <p className={`${styles.notice} ${styles.error}`}>{error}</p>}
    </section>
  );
}
