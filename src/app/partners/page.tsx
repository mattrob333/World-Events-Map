'use client';
import Link from 'next/link';
import { explainPlatformError } from '@/lib/platform/errors';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  validateOffer,
  type PartnerOffer,
  type ProviderOrganization,
} from '@/lib/platform/types';
import styles from './studio.module.css';
import { EVENTS } from '@/lib/data/events';
import { EventSubmission } from './EventSubmission';

type Inquiry = {
  id: string;
  offer_id: string;
  message: string;
  status: string;
  response: string;
  created_at: string;
};
const blank = {
  title: '',
  destination: '',
  event_id: '',
  description: '',
  kind: 'stay' as PartnerOffer['kind'],
  price_label: '',
  availability: 'request' as PartnerOffer['availability'],
  expires_at: '',
};
export default function PartnerStudio() {
  const { user } = usePlatformAuth();
  return <PartnerStudioContent key={user?.id ?? 'visitor'} />;
}

function PartnerStudioContent() {
  const {
    client,
    user,
    loading,
    error: authError,
    signIn,
    signOut,
  } = usePlatformAuth();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, []);
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [org, setOrg] = useState<ProviderOrganization | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [submittedEvents, setSubmittedEvents] = useState<
    { id: string; name: string; destination: string }[]
  >([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const refresh = useCallback(async () => {
    if (!client || !user) return;
    const { data, error } = await client
      .from('provider_orgs')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) {
      setError(error.message);
      setLoaded(true);
      return;
    }
    setOrg(data);
    setLoaded(true);
    if (data) {
      const approvedEvents = await client
        .from('event_submissions')
        .select('id,name,destination')
        .eq('provider_id', data.id)
        .eq('status', 'approved')
        .order('start_date');
      if (approvedEvents.error) setError(approvedEvents.error.message);
      setSubmittedEvents(approvedEvents.data ?? []);
      const ownOffers = await client
        .from('offers')
        .select('*')
        .eq('provider_id', data.id)
        .order('created_at', { ascending: false });
      const ownInquiries = ownOffers.data?.length
        ? await client
            .from('inquiries')
            .select('*')
            .in(
              'offer_id',
              ownOffers.data.map((o) => o.id),
            )
            .order('created_at', { ascending: false })
        : { data: [], error: null };
      const results = [ownOffers, ownInquiries];
      if (results[0].error || results[1].error)
        setError(
          results[0].error?.message ??
            results[1].error?.message ??
            'Unable to load your studio.',
        );
      setOffers(results[0].data ?? []);
      setInquiries(results[1].data ?? []);
    }
  }, [client, user]);
  useEffect(() => {
    const task = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(task);
  }, [refresh]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (e) {
      setError(explainPlatformError(e));
    } finally {
      setBusy(false);
    }
  }
  async function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      const { error } = await client!.from('provider_orgs').insert({
        owner_id: user!.id,
        name: String(form.get('name')).trim(),
        category: form.get('category'),
        website: String(form.get('website')).trim(),
        description: String(form.get('description')).trim(),
      });
      if (error) throw error;
      await refresh();
      setNotice(
        'Application saved. Your business is pending review; you can prepare offers while we verify it.',
      );
    });
  }
  async function saveOffer(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const reason = validateOffer(draft);
      if (reason) throw new Error(reason);
      const payload = {
        ...draft,
        event_id: draft.event_id.trim() || null,
        expires_at: new Date(draft.expires_at).toISOString(),
        provider_id: org!.id,
        status: 'draft',
      };
      const wasPublished = Boolean(editing && offers.find((offer) => offer.id === editing)?.status === 'published');
      const result = editing
        ? await client!.from('offers').update(payload).eq('id', editing)
        : await client!.from('offers').insert(payload);
      if (result.error) throw result.error;
      setDraft(blank);
      setEditing(null);
      await refresh();
      setNotice(
        wasPublished
          ? 'Saved. This offer is now hidden from travelers until you publish it again.'
          : 'Offer saved as a draft. Preview it below before publishing.',
      );
    });
  }
  async function changeStatus(id: string, status: string) {
    await run(async () => {
      const { error } = await client!
        .from('offers')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
      await refresh();
      setNotice(
        status === 'published'
          ? 'Offer published. Travelers can now request availability.'
          : 'Offer paused.',
      );
    });
  }
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Partner studio</p>
        <nav>
          <Link href="/access">Traveler ACCESS</Link>
          {user && <button onClick={() => void run(signOut)}>Sign out</button>}
        </nav>
      </header>
      {org && (
        <p className={styles.statusLine}>
          Studio status: <strong>{org.status}</strong>
          {org.status === 'pending' && ' — offers stay unpublished until review.'}
          {org.status === 'approved' && ' — you can publish inquiry-only offers.'}
        </p>
      )}
      <section className={styles.intro}>
        <p className={styles.eyebrow}>BE THERE WHEN THEY DECIDE TO GO</p>
        <h1>
          Extraordinary places.
          <br />
          The people who make them happen.
        </h1>
        <p>
          Bring your stays, arrivals, access and expertise to travelers already
          imagining their next chapter.
        </p>
      </section>
      {(error || authError) && (
        <p role="alert" className={styles.error}>
          {error || authError}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {!client ? (
        <section className={styles.card}>
          <h2>Partner applications are not open in this preview.</h2>
          <p>
            Nothing has been submitted or saved. When the partner studio opens,
            this is how it works:
          </p>
          <ol className={styles.howItWorks}>
            <li><strong>Apply.</strong> Tell us about your business and link your website.</li>
            <li><strong>MERIDIAN reviews it.</strong> You can draft offers while you wait.</li>
            <li><strong>Publish inquiry-only offers.</strong> Stays, arrivals, access and experiences around the trips travelers are planning.</li>
            <li><strong>Reply to requests.</strong> Travelers send inquiries; you confirm dates, price and terms.</li>
          </ol>
          <p>
            MERIDIAN takes no bookings, payments or inventory holds.
          </p>
          <p>
            <Link href="/access">See how travelers browse ACCESS ↗</Link>
          </p>
        </section>
      ) : loading ? (
        <p>Checking your session…</p>
      ) : !user ? (
        <section className={styles.card}>
          <h2>Your place in the world starts here.</h2>
          <p>
            Sign in with an email link to apply as a partner or return to your
            studio.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await signIn(email);
                setNotice('Check your email for a secure sign-in link.');
              });
            }}
          >
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button disabled={busy} className={styles.primary}>
              Send sign-in link
            </button>
          </form>
        </section>
      ) : !loaded ? (
        <p>Loading your studio…</p>
      ) : !org ? (
        <section className={styles.card}>
          <h2>Introduce your business.</h2>
          <p>Applications are reviewed before offers can appear publicly.</p>
          <form onSubmit={apply}>
            <label>
              Business name
              <input name="name" required minLength={2} maxLength={120} />
            </label>
            <label>
              Specialty
              <select name="category">
                <option value="hotel">Hotels & villas</option>
                <option value="chauffeur">Chauffeur services</option>
                <option value="aviation">Private aviation</option>
                <option value="organizer">Events & experiences</option>
                <option value="advisor">Travel advisor</option>
              </select>
            </label>
            <label>
              Website
              <input
                name="website"
                type="url"
                pattern="https://.*"
                placeholder="https://"
                required
              />
            </label>
            <label>
              What makes your business special?
              <textarea name="description" maxLength={2000} required />
            </label>
            <button className={styles.primary} disabled={busy}>
              Submit for review
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className={styles.card}>
            <div className={styles.row}>
              <div>
                <p className={styles.eyebrow}>
                  {org.category} · {org.status}
                </p>
                <h2>{org.name}</h2>
              </div>
              <button disabled={busy} onClick={() => void run(refresh)}>
                Refresh studio
              </button>
            </div>
            <p>
              {org.status === 'approved'
                ? 'Your business is verified. Publish relevant offers and respond to traveler requests here.'
                : org.status === 'suspended'
                  ? 'Publication is suspended. Existing offers are hidden from travelers. Contact the platform team for review.'
                  : 'Your application is pending review. Draft offers now; publishing unlocks after approval.'}
            </p>
          </section>
          <div className={styles.grid}>
            <section className={styles.card}>
              <h2>
                {editing
                  ? 'Edit your offer'
                  : 'Create something worth traveling for.'}
              </h2>
              <form onSubmit={saveOffer}>
                <label>
                  Offer title
                  <input
                    required
                    minLength={3}
                    maxLength={140}
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </label>
                <div className={styles.fields}>
                  <label>
                    Type
                    <select
                      value={draft.kind}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          kind: e.target.value as PartnerOffer['kind'],
                        })
                      }
                    >
                      <option value="stay">Stay</option>
                      <option value="arrive">Arrive</option>
                      <option value="access">Access</option>
                      <option value="curated">Curated trip</option>
                    </select>
                  </label>
                  <label>
                    Destination
                    <input
                      required
                      maxLength={120}
                      value={draft.destination}
                      onChange={(e) =>
                        setDraft({ ...draft, destination: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Related event (optional)
                  <select
                    value={draft.event_id}
                    onChange={(e) =>
                      setDraft({ ...draft, event_id: e.target.value })
                    }
                  >
                    <option value="">
                      Destination offer · no specific event
                    </option>
                    {submittedEvents.map((event) => (
                      <option
                        key={`partner-${event.id}`}
                        value={`partner-${event.id}`}
                      >
                        {event.name} · {event.destination} · Your event
                      </option>
                    ))}
                    {EVENTS.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name} · {event.city}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Inclusions, dates and terms
                  <textarea
                    required
                    minLength={10}
                    maxLength={3000}
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </label>
                <label>
                  Price description
                  <input
                    maxLength={100}
                    value={draft.price_label}
                    onChange={(e) =>
                      setDraft({ ...draft, price_label: e.target.value })
                    }
                    placeholder="From €1,200 per night, including taxes"
                  />
                </label>
                <label>
                  Availability basis
                  <select
                    value={draft.availability}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        availability: e.target
                          .value as PartnerOffer['availability'],
                      })
                    }
                  >
                    <option value="request">Request availability</option>
                    <option value="provider_updated">
                      Provider updated · subject to confirmation
                    </option>
                  </select>
                </label>
                <label>
                  Offer expires (your local time)
                  <input
                    type="datetime-local"
                    required
                    value={draft.expires_at}
                    onChange={(e) =>
                      setDraft({ ...draft, expires_at: e.target.value })
                    }
                  />
                </label>
                <p className={styles.muted}>
                  Every offer leads to an inquiry, not a confirmed reservation.
                  Saving changes to a published offer hides it from travelers until you publish it again.
                </p>
                <div className={styles.actions}>
                  <button className={styles.primary} disabled={busy}>
                    Save draft
                  </button>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setDraft(blank);
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
            </section>
            <section>
              <h2>Your offers</h2>
              {offers.length === 0 && (
                <p className={styles.muted}>
                  Your first offer will appear here with a preview.
                </p>
              )}
              {offers.map((offer) => (
                <article className={styles.card} key={offer.id}>
                  <p className={styles.eyebrow}>
                    {offer.kind} · {offer.destination} ·{' '}
                    {Date.parse(offer.expires_at) <= now
                      ? 'expired'
                      : offer.status}
                  </p>
                  <h3>{offer.title}</h3>
                  <p>{offer.description}</p>
                  <strong>{offer.price_label || 'Price on request'}</strong>
                  <p className={styles.muted}>
                    {offer.availability === 'provider_updated'
                      ? 'Provider updated · subject to confirmation'
                      : 'Request availability'}{' '}
                    · Expires {new Date(offer.expires_at).toLocaleString()}
                  </p>
                  <div className={styles.actions}>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(offer.id);
                        const d = new Date(offer.expires_at);
                        setDraft({
                          ...offer,
                          event_id: offer.event_id ?? '',
                          expires_at: new Date(
                            d.getTime() - d.getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16),
                        });
                      }}
                    >
                      Edit
                    </button>
                    {offer.status === 'published' ? (
                      <button
                        disabled={busy}
                        onClick={() => void changeStatus(offer.id, 'paused')}
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        disabled={
                          busy ||
                          org.status !== 'approved' ||
                          Date.parse(offer.expires_at) <= now
                        }
                        onClick={() => void changeStatus(offer.id, 'published')}
                      >
                        Publish
                      </button>
                    )}
                    {offer.status === 'draft' && inquiries.some((inquiry) => inquiry.offer_id === offer.id) && (
                      <span className={styles.muted}>Has traveler requests, so it stays on record.</span>
                    )}
                    {offer.status === 'draft' && !inquiries.some((inquiry) => inquiry.offer_id === offer.id) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const { error } = await client
                              .from('offers')
                              .delete()
                              .eq('id', offer.id);
                            if (error) throw error;
                            await refresh();
                          })
                        }
                      >
                        Delete draft
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          </div>
          <EventSubmission client={client} providerId={org.id} />
          <section className={styles.card}>
            <h2>Traveler requests</h2>
            <p className={styles.muted}>
              Only the request details intentionally shared by the traveler
              appear here. Respond with availability and next steps.
            </p>
            {inquiries.length === 0 ? (
              <p>No requests yet.</p>
            ) : (
              inquiries.map((inquiry) => (
                <article className={styles.inquiry} key={inquiry.id}>
                  <p className={styles.eyebrow}>
                    {offers.find((o) => o.id === inquiry.offer_id)?.title ??
                      'Offer request'}{' '}
                    · {inquiry.status}
                  </p>
                  <p>{inquiry.message}</p>
                  <small>{new Date(inquiry.created_at).toLocaleString()}</small>
                  <label>
                    Your response
                    <textarea
                      maxLength={4000}
                      value={responses[inquiry.id] ?? inquiry.response}
                      onChange={(e) =>
                        setResponses({
                          ...responses,
                          [inquiry.id]: e.target.value,
                        })
                      }
                    />
                  </label>
                  <div className={styles.actions}>
                    <button
                      disabled={
                        busy ||
                        !(responses[inquiry.id] ?? inquiry.response).trim()
                      }
                      onClick={() =>
                        void run(async () => {
                          const { error } = await client
                            .from('inquiries')
                            .update({
                              response: (
                                responses[inquiry.id] ?? inquiry.response
                              ).trim(),
                              status: 'replied',
                            })
                            .eq('id', inquiry.id);
                          if (error) throw error;
                          await refresh();
                          setNotice(
                            'Response saved. The traveler sees it in Community under Your requests.',
                          );
                        })
                      }
                    >
                      Send response
                    </button>
                    <button
                      disabled={busy || inquiry.status === 'closed'}
                      onClick={() =>
                        void run(async () => {
                          const { error } = await client
                            .from('inquiries')
                            .update({ status: 'closed' })
                            .eq('id', inquiry.id);
                          if (error) throw error;
                          await refresh();
                        })
                      }
                    >
                      Close request
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      )}
      <footer className={styles.footer}>
        A considered connection. Every time.{' '}
        <Link href="/">Return to the world</Link>
      </footer>
    </main>
  );
}
