'use client';
import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EVENT_CATEGORIES } from '@/lib/types';
import styles from './studio.module.css';
type Submission = {
  id: string;
  name: string;
  destination: string;
  start_date: string;
  status: string;
};
export function EventSubmission({
  client,
  providerId,
}: {
  client: SupabaseClient;
  providerId: string;
}) {
  const [rows, setRows] = useState<Submission[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void client
      .from('event_submissions')
      .select('id,name,destination,start_date,status')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRows(data ?? []);
      });
  }, [client, providerId]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    const payload = {
      provider_id: providerId,
      name: String(f.get('name')).trim(),
      description: String(f.get('description')).trim(),
      destination: String(f.get('destination')).trim(),
      venue: String(f.get('venue')).trim(),
      country: String(f.get('country')).trim(),
      country_code: String(f.get('country_code')).trim().toUpperCase(),
      timezone: String(f.get('timezone')).trim() || 'UTC',
      category: f.get('category'),
      start_date: f.get('start_date'),
      end_date: f.get('end_date'),
      latitude: Number(f.get('latitude')),
      longitude: Number(f.get('longitude')),
    };
    const { data, error } = await client
      .from('event_submissions')
      .insert(payload)
      .select('id,name,destination,start_date,status')
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setRows([data, ...rows]);
    form.reset();
    setNotice(
      'Event submitted for editorial review. It is not publicly listed until approved.',
    );
  }
  return (
    <section className={styles.card}>
      <p className={styles.eyebrow}>HOST SOMETHING EXTRAORDINARY</p>
      <h2>Put your event on the radar.</h2>
      <p>
        Submit an original gathering for review. Approved events can be
        discovered in the community; your offers can connect travelers with
        access.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Event name
          <input name="name" minLength={3} maxLength={140} required />
        </label>
        <div className={styles.fields}>
          <label>
            Destination
            <input name="destination" required minLength={2} maxLength={120} />
          </label>
          <label>
            Venue
            <input name="venue" maxLength={200} required />
          </label>
        </div>
        <label>
          Country
          <input
            name="country"
            required
            minLength={2}
            maxLength={120}
            placeholder="France"
          />
        </label>
        <div className={styles.fields}>
          <label>
            Two-letter country code
            <input
              name="country_code"
              required
              minLength={2}
              maxLength={2}
              pattern="[A-Za-z]{2}"
              placeholder="FR"
            />
          </label>
          <label>
            Event time zone
            <input
              name="timezone"
              required
              defaultValue="UTC"
              placeholder="Europe/Paris"
              list="event-timezones"
            />
            <datalist id="event-timezones">
              <option value="UTC" />
              <option value="Europe/Paris" />
              <option value="Europe/London" />
              <option value="America/New_York" />
              <option value="Asia/Dubai" />
              <option value="Asia/Singapore" />
            </datalist>
            <small>Use an IANA name, such as Europe/Paris.</small>
          </label>
        </div>
        <label>
          Category
          <select name="category">
            {EVENT_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className={styles.fields}>
          <label>
            First day
            <input type="date" name="start_date" required />
          </label>
          <label>
            Last day
            <input type="date" name="end_date" required />
          </label>
          <label>
            Venue latitude
            <input
              type="number"
              name="latitude"
              min={-90}
              max={90}
              step="any"
              required
            />
          </label>
          <label>
            Venue longitude
            <input
              type="number"
              name="longitude"
              min={-180}
              max={180}
              step="any"
              required
            />
          </label>
        </div>
        <label>
          Description and access details
          <textarea
            name="description"
            minLength={10}
            maxLength={3000}
            required
          />
        </label>
        <button disabled={busy} className={styles.primary}>
          {busy ? 'Submitting…' : 'Submit event for review'}
        </button>
      </form>
      {rows.length > 0 && (
        <div>
          <h3>Your submissions</h3>
          {rows.map((row) => (
            <p key={row.id}>
              <strong>{row.name}</strong> · {row.destination} · {row.start_date}{' '}
              · {row.status}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
