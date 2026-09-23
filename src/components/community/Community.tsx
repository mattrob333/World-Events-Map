'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import {
  OFFER_PRICE_QUALIFIER,
  PARTNER_OFFER_KIND_LABEL,
  fetchPublishedOffers,
  offerAvailabilityLabel,
} from '@/lib/platform/offers';
import { circleInvitePath, circleInviteUrl } from '@/lib/trips/circleInvite';
import { PlatformShell, SignInCard } from './PlatformShell';
import styles from './community.module.css';
import { RequestGate } from './requestGate';

type Circle = {
  id: string;
  host_id: string;
  event_id: string | null;
  name: string;
  description: string;
  destination: string;
  departure_city: string;
  start_date: string;
  end_date: string;
  capacity: number;
};
type Membership = {
  circle_id: string;
  user_id: string;
  status: 'pending' | 'accepted';
};
type Message = {
  id: string;
  circle_id: string;
  user_id: string;
  body: string;
  created_at: string;
};
type Profile = {
  id: string;
  display_name: string;
  home_city: string;
  interests: string[];
  bio: string;
};
type Offer = {
  id: string;
  title: string;
  description: string;
  destination: string;
  event_id: string | null;
  kind: string;
  price_label: string;
  availability: string;
  expires_at: string | null;
  created_at: string;
  provider_name?: string;
};
type Inquiry = {
  id: string;
  offer_id: string;
  message: string;
  status: string;
  response: string | null;
  created_at: string;
};
const explain = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : typeof cause === 'object' && cause && 'message' in cause
      ? String(cause.message)
      : 'Something went wrong. Please try again.';
const date = (value: string) =>
  new Date(
    value.length === 10 ? value + 'T12:00:00' : value,
  ).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export type CommunityTab = 'circles' | 'offers' | 'requests';

export function Community({
  initialEvent = '',
  initialCircle = '',
  initialTab = 'circles',
  initialOffer = '',
}: {
  initialEvent?: string;
  initialCircle?: string;
  initialTab?: CommunityTab;
  initialOffer?: string;
}) {
  const { user } = usePlatformAuth();
  return (
    <CommunityContent
      key={user?.id ?? 'visitor'}
      initialEvent={initialEvent}
      initialCircle={initialCircle}
      initialTab={initialTab}
      initialOffer={initialOffer}
    />
  );
}

function CommunityContent({
  initialEvent,
  initialCircle,
  initialTab,
  initialOffer,
}: {
  initialEvent: string;
  initialCircle: string;
  initialTab: CommunityTab;
  initialOffer: string;
}) {
  const { client, user, loading } = usePlatformAuth();
  const [tab, setTab] = useState<CommunityTab>(initialOffer ? 'offers' : initialTab);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [selected, setSelected] = useState<Circle | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [members, setMembers] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const circleRequests = useRef(new RequestGate());
  const [detailFor, setDetailFor] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(Boolean(client));
  const [composer, setComposer] = useState(false);
  const [body, setBody] = useState('');
  const [offerRequest, setOfferRequest] = useState<Offer | null>(null);
  const [requestText, setRequestText] = useState('');
  const eventId = initialEvent;
  const [eventFilter, setEventFilter] = useState(initialEvent);
  const circlePath = initialCircle ? circleInvitePath(initialCircle) : null;
  const openedOffer = useRef(false);

  const refresh = useCallback(async () => {
    if (!client) return;
    try {
      const results = await Promise.all([
        user
          ? client
              .from('circles')
              .select('*')
              .order('start_date', { ascending: true })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
        fetchPublishedOffers(client).then(({ offers: published, error: offerError }) => ({
          data: published as Offer[],
          error: offerError ? new Error(offerError) : null,
        })),
        user
          ? client.from('circle_members').select('*').eq('user_id', user.id)
          : Promise.resolve({ data: [], error: null }),
        user
          ? client
              .from('inquiries')
              .select('*')
              .eq('traveler_id', user.id)
              .order('created_at', { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const failure = results.find((result) => result.error)?.error;
      if (failure) throw failure;
      setCircles(results[0].data ?? []);
      setOffers(results[1].data ?? []);
      if (initialOffer && !openedOffer.current) {
        openedOffer.current = true;
        const match = (results[1].data ?? []).find((offer) => offer.id === initialOffer);
        if (match) setOfferRequest(match);
        else setNotice('That partner offer is no longer available. Here are the current ones.');
      }
      setMemberships(results[2].data ?? []);
      setInquiries(results[3].data ?? []);
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setFetching(false);
    }
  }, [client, user, initialOffer]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!client || !user || !initialCircle) return;
    if (!circlePath) return;
    let active = true;
    void client.from('circles').select('*').eq('id', initialCircle).maybeSingle().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) {
        setError(explain(loadError));
      } else if (!data) {
        setError('This Circle could not be found. Ask the host for a current link.');
      } else {
        setTab('circles');
        setEventFilter('');
        setSelected(data as Circle);
      }
    });
    return () => { active = false; };
  }, [client, user, initialCircle, circlePath]);

  const loadCircle = useCallback(async () => {
    if (!client || !selected || !user) return;
    const current = circleRequests.current.begin();
    try {
      // Recheck membership on every poll so revoked access also removes the composer.
      const membership = await client
        .from('circle_members')
        .select('*')
        .eq('circle_id', selected.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!current()) return;
      if (membership.error) throw membership.error;
      setMemberships((previous) => {
        const prior = previous.find(
          (member) => member.circle_id === selected.id,
        );
        if (prior?.status === membership.data?.status) return previous;
        return [
          ...previous.filter((member) => member.circle_id !== selected.id),
          ...(membership.data ? [membership.data as Membership] : []),
        ];
      });
      if (
        selected.host_id !== user.id &&
        membership.data?.status !== 'accepted'
      ) {
        setMembers([]);
        setMessages([]);
        setProfiles({});
        setDetailFor('');
        return;
      }
      const [roster, thread] = await Promise.all([
        client.from('circle_members').select('*').eq('circle_id', selected.id),
        client
          .from('circle_messages')
          .select('*')
          .eq('circle_id', selected.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);
      if (!current()) return;
      if (roster.error || thread.error) throw roster.error ?? thread.error;
      const ids = [
        ...new Set([
          ...(roster.data ?? []).map((m) => m.user_id),
          ...(thread.data ?? []).map((m) => m.user_id),
        ]),
      ];
      const people = ids.length
        ? await client
            .from('profiles')
            .select('id,display_name,home_city,interests,bio')
            .in('id', ids)
        : { data: [], error: null };
      if (!current()) return;
      if (people.error) throw people.error;
      setMembers(roster.data ?? []);
      setMessages((thread.data ?? []).reverse());
      setProfiles(
        Object.fromEntries(
          (people.data ?? []).map((profile) => [profile.id, profile]),
        ),
      );
      setDetailFor(selected.id);
    } catch (cause) {
      if (current()) {
        setError(explain(cause));
        setDetailFor('');
      }
    }
  }, [client, selected, user]);

  useEffect(() => {
    void loadCircle();
    if (!selected || !user) return;
    const timer = window.setInterval(() => {
      void loadCircle();
    }, 15000);
    return () => {
      window.clearInterval(timer);
      circleRequests.current.invalidate();
    };
  }, [loadCircle, selected, user]);

  async function action(
    work: () => PromiseLike<{ error: { message: string } | null }>,
    success: string,
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await work();
      if (result.error) throw result.error;
      setNotice(success);
      await refresh();
      await loadCircle();
    } catch (cause) {
      setError(explain(cause));
    } finally {
      setBusy(false);
    }
  }

  async function createCircle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || !user) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    if (String(data.get('end')) < String(data.get('start'))) {
      setError('Choose an end date on or after the start date.');
      return;
    }
    await action(async () => {
      const result = await client
        .from('circles')
        .insert({
          host_id: user.id,
          name: String(data.get('name')).trim(),
          destination: String(data.get('destination')).trim(),
          departure_city: String(data.get('departure')).trim(),
          description: String(data.get('description')).trim(),
          start_date: data.get('start'),
          end_date: data.get('end'),
          capacity: Number(data.get('capacity')),
          event_id: eventId || null,
        });
      if (!result.error) {
        setComposer(false);
        form.reset();
      }
      return result;
    }, 'Your circle is open for requests. You approve who joins.');
  }

  const mine = selected
    ? memberships.find((m) => m.circle_id === selected.id)
    : undefined;
  const host = Boolean(user && selected?.host_id === user.id);
  const accepted = Boolean(user && (host || mine?.status === 'accepted'));
  const shownCircles = eventFilter
    ? circles.filter((c) => c.event_id === eventFilter)
    : circles;
  const shownOffers = eventFilter
    ? offers.filter((o) => o.event_id === eventFilter)
    : offers;

  return (
    <PlatformShell
      eyebrow="Good places. Better company."
      title="Find your next circle."
      description="Meet around a shared interest, shape a weekend together, and ask trusted travel partners to take care of the details."
    >
      {initialCircle && !circlePath && <p className={`${styles.notice} ${styles.error}`}>This Circle link is invalid. Ask the host for a new link.</p>}
      {circlePath && !user && client && <p className={styles.notice}>Sign in below to open this Circle invitation. The host approves requests before you can join its private conversation.</p>}
      {circlePath && !client && <p className={styles.notice}>This Circle invitation needs member sign-in, which is not available on this preview yet. Nothing was joined. Ask the host to share the trip details another way.</p>}
      <div
        className={styles.tabs}
        role="tablist"
        aria-label="Community sections"
      >
        {(['circles', 'offers', 'requests'] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            className={`${styles.button} ${styles.secondary} ${tab === value ? styles.active : ''}`}
            onClick={() => setTab(value)}
          >
            {value === 'circles'
              ? 'Travel circles'
              : value === 'offers'
                ? 'Partner offers'
                : 'Your requests'}
          </button>
        ))}
      </div>
      {error && (
        <div className={`${styles.notice} ${styles.error}`} role="alert">
          {error}
          <button
            className={`${styles.button} ${styles.secondary}`}
            onClick={() => {
              setError('');
              void refresh();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {eventFilter && (
        <p className={styles.notice}>
          Showing circles and offers for your selected event.{' '}
          <button
            className={`${styles.button} ${styles.secondary}`}
            onClick={() => setEventFilter('')}
          >
            Show all destinations
          </button>
        </p>
      )}
      <div className={styles.grid}>
        <section className={styles.stack}>
          {tab === 'circles' && (
            <>
              <div className={styles.between}>
                <h2>Make a plan worth sharing.</h2>
                {user && (
                  <button
                    className={styles.button}
                    onClick={() => setComposer(!composer)}
                  >
                    {composer ? 'Close form' : 'Start a circle'}
                  </button>
                )}
              </div>
              {composer && user && (
                <section className={styles.card}>
                  <h2>Bring your people together</h2>
                  <form className={styles.form} onSubmit={createCircle}>
                    <label>
                      Circle name
                      <input
                        name="name"
                        required
                        maxLength={100}
                        placeholder="A weekend of art in Paris"
                      />
                    </label>
                    <label>
                      Destination
                      <input
                        name="destination"
                        required
                        maxLength={120}
                        placeholder="Paris, France"
                      />
                    </label>
                    <label>
                      Starting from
                      <input
                        name="departure"
                        maxLength={120}
                        placeholder="London, or meet us there"
                      />
                    </label>
                    <div className={styles.split}>
                      <label>
                        Starts
                        <input name="start" type="date" required />
                      </label>
                      <label>
                        Ends
                        <input name="end" type="date" required />
                      </label>
                    </div>
                    <label>
                      Places, including you
                      <input
                        name="capacity"
                        type="number"
                        required
                        min={2}
                        max={25}
                        defaultValue={6}
                      />
                    </label>
                    <label>
                      The invitation
                      <textarea
                        name="description"
                        required
                        maxLength={2000}
                        placeholder="What you have in mind, shared interests, and what everyone should know."
                      />
                    </label>
                    <p className={styles.small}>
                      The circle invitation is visible to signed-in members.
                      Keep exact accommodation and personal travel details for
                      your private group chat. Starting a circle does not book
                      travel.
                    </p>
                    <button className={styles.button} disabled={busy}>
                      Create circle
                    </button>
                  </form>
                </section>
              )}
              {fetching ? (
                <p className={styles.empty}>Loading travel circles…</p>
              ) : shownCircles.length === 0 ? (
                <section className={styles.card}>
                  <h2>The next great weekend starts with someone.</h2>
                  <p className={styles.muted}>
                    {client
                      ? user
                        ? 'No circles have been posted here yet. Start one around an event or a shared interest.'
                        : 'Sign in to discover member travel circles and request a place.'
                      : 'Travel circles will appear when membership is connected. Explore events on the globe in the meantime.'}
                  </p>
                </section>
              ) : (
                shownCircles.map((circle) => {
                  const membership = memberships.find(
                    (m) => m.circle_id === circle.id,
                  );
                  return (
                    <article
                      key={circle.id}
                      className={`${styles.card} ${selected?.id === circle.id ? styles.selected : ''}`}
                    >
                      <span className={styles.eyebrow}>
                        {circle.destination}
                      </span>
                      <h2>{circle.name}</h2>
                      <p className={styles.muted}>{circle.description}</p>
                      <p className={styles.small}>
                        {date(circle.start_date)} – {date(circle.end_date)} · Up
                        to {circle.capacity} travelers
                        {circle.departure_city
                          ? ` · From ${circle.departure_city}`
                          : ''}
                      </p>
                      <div className={styles.row}>
                        <button
                          className={`${styles.button} ${styles.secondary}`}
                          onClick={() => {
                            circleRequests.current.invalidate();
                            setDetailFor('');
                            setSelected(circle);
                            setInviteLink('');
                            setMessages([]);
                            setMembers([]);
                            setProfiles({});
                          }}
                        >
                          Open circle
                        </button>
                        {membership && (
                          <span className={styles.tag}>
                            {membership.status === 'accepted'
                              ? 'You’re in this circle'
                              : 'Request pending'}
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </>
          )}
          {tab === 'offers' && (
            <>
              <h2>A good reason to go.</h2>
              <p className={styles.muted}>
                Stays, arrivals and access from travel partners. Availability is
                confirmed by the provider when they reply.
              </p>
              {!client ? (
                <section className={styles.card}>
                  <h2>Partner offers are not connected yet.</h2>
                  <p className={styles.muted}>
                    Offers appear here once the partner service is connected.
                    Nothing has been checked yet, so this is not a list of zero
                    offers. <a className={styles.inlineLink} href="/access">See sample opportunities in ACCESS ↗</a>
                  </p>
                </section>
              ) : fetching ? (
                <p>Loading offers…</p>
              ) : shownOffers.length === 0 ? (
                <section className={styles.card}>
                  <h2>Something worth waiting for.</h2>
                  <p className={styles.muted}>
                    No published offers are available here yet. Offers appear
                    after a partner publishes them; we do not invent
                    availability or savings.
                  </p>
                </section>
              ) : (
                shownOffers.map((offer) => (
                  <article key={offer.id} className={styles.card}>
                    <span className={styles.eyebrow}>
                      {PARTNER_OFFER_KIND_LABEL[offer.kind as keyof typeof PARTNER_OFFER_KIND_LABEL] ?? offer.kind} · {offer.destination}
                    </span>
                    <h2>{offer.title}</h2>
                    <p className={styles.small}>Verified partner: {offer.provider_name ?? 'Verified partner'}</p>
                    <p className={styles.muted}>{offer.description}</p>
                    <p>{offer.price_label || 'Ask the provider for a quote'}</p>
                    <p className={styles.small}>{OFFER_PRICE_QUALIFIER}</p>
                    <p className={styles.small}>
                      {offerAvailabilityLabel(offer)}
                      {offer.expires_at
                        ? ` · Offer ends ${date(offer.expires_at)}`
                        : ''}
                    </p>
                    <button
                      className={styles.button}
                      onClick={() => {
                        setOfferRequest(offer);
                        setRequestText('');
                      }}
                    >
                      Ask about this offer
                    </button>
                  </article>
                ))
              )}
            </>
          )}
          {tab === 'requests' && (
            <>
              <h2>Your partner requests.</h2>
              {!user ? (
                <p className={styles.empty}>
                  Sign in to see your requests and provider replies.
                </p>
              ) : inquiries.length === 0 ? (
                <p className={styles.empty}>
                  You have not sent a partner request yet. Find an offer that
                  fits your plans to start a conversation.
                </p>
              ) : (
                inquiries.map((inquiry) => (
                  <article key={inquiry.id} className={styles.card}>
                    <span className={styles.tag}>{inquiry.status}</span>
                    <h3>
                      {offers.find((offer) => offer.id === inquiry.offer_id)
                        ?.title ?? 'Your travel request'}
                    </h3>
                    <p className={styles.muted}>{inquiry.message}</p>
                    <p className={styles.small}>
                      Sent {date(inquiry.created_at)}
                    </p>
                    {inquiry.response ? (
                      <div className={styles.notice}>
                        <strong>Provider reply</strong>
                        <p>{inquiry.response}</p>
                      </div>
                    ) : (
                      <p className={styles.small}>
                        Waiting for the provider to reply.
                      </p>
                    )}
                  </article>
                ))
              )}
              {user && (
                <button
                  className={`${styles.button} ${styles.secondary}`}
                  onClick={() => void refresh()}
                >
                  Refresh replies
                </button>
              )}
            </>
          )}
        </section>
        <aside className={styles.stack}>
          <SignInCard />
          {user && (
            <a
              className={`${styles.button} ${styles.secondary}`}
              href="/account"
            >
              Edit your introduction & privacy
            </a>
          )}
          {offerRequest && (
            <section className={styles.card}>
              <div className={styles.between}>
                <h2>Make it your trip.</h2>
                <button
                  aria-label="Close offer request"
                  className={`${styles.button} ${styles.secondary}`}
                  onClick={() => setOfferRequest(null)}
                >
                  Close
                </button>
              </div>
              <h3>{offerRequest.title}</h3>
              {user ? (
                <form
                  className={styles.form}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!client) return;
                    await action(async () => {
                      const result = await client
                        .from('inquiries')
                        .insert({
                          offer_id: offerRequest.id,
                          traveler_id: user.id,
                          message: requestText.trim(),
                        });
                      if (!result.error) {
                        setOfferRequest(null);
                        setRequestText('');
                        setTab('requests');
                      }
                      return result;
                    }, 'Your request has been sent. The provider can reply here.');
                  }}
                >
                  <label>
                    Your request
                    <textarea
                      required
                      maxLength={2000}
                      minLength={10}
                      value={requestText}
                      onChange={(event) => setRequestText(event.target.value)}
                      placeholder="Your dates, party size, and what would make this trip special."
                    />
                  </label>
                  <p className={styles.small}>
                    This sends an inquiry, not a booking. The provider sees this
                    message, not your profile, and will confirm availability,
                    price and next steps. Replies appear under Your requests.
                    Avoid including payment information.
                  </p>
                  <button
                    className={styles.button}
                    disabled={busy || requestText.trim().length < 10}
                  >
                    Send request
                  </button>
                </form>
              ) : (
                <p className={styles.muted}>
                  Sign in above to send your request.
                </p>
              )}
            </section>
          )}
          {selected && tab === 'circles' && (
            <section className={styles.card}>
              <div className={styles.between}>
                <span className={styles.eyebrow}>Inside the circle</span>
                <button
                  aria-label="Close circle"
                  className={`${styles.button} ${styles.secondary}`}
                  onClick={() => {
                    circleRequests.current.invalidate();
                    setDetailFor('');
                    setSelected(null);
                    setInviteLink('');
                  }}
                >
                  Close
                </button>
              </div>
              <h2>{selected.name}</h2>
              <p className={styles.muted}>{selected.description}</p>
              <p className={styles.small}>After arrival: <a className={styles.inlineLink} href="/now">use NOW ↗</a> to explore nearby places and timing. Live venue guidance appears when its sources are connected.</p>
              <div className={styles.row}>
                <button className={`${styles.button} ${styles.secondary}`} onClick={async () => {
                  const url = circleInviteUrl(window.location.origin, selected.id);
                  if (!url) return;
                  setInviteLink(url);
                  try {
                    await navigator.clipboard.writeText(url);
                    setNotice('Circle link copied. Recipients must sign in and request host approval.');
                  } catch {
                    setNotice('Select and copy the Circle link below. Recipients must sign in and request host approval.');
                  }
                }}>Copy Circle link</button>
                <span className={styles.small}>Sharing the link does not grant access.</span>
              </div>
              {inviteLink && <div className={styles.form}><label>Invitation link<input readOnly value={inviteLink} onFocus={(event) => event.currentTarget.select()} /></label></div>}
              {!user ? (
                <p>Sign in to request a place.</p>
              ) : !mine && !host ? (
                <>
                  <p className={styles.small}>
                    Your introduction is shared with the host when you request
                    to join. The host decides who joins; this is not a travel
                    booking.
                  </p>
                  <button
                    className={styles.button}
                    disabled={busy}
                    onClick={() => {
                      if (client)
                        void action(
                          () =>
                            client
                              .from('circle_members')
                              .insert({
                                circle_id: selected.id,
                                user_id: user.id,
                                status: 'pending',
                              }),
                          'Your request was sent to the circle host.',
                        );
                    }}
                  >
                    Request to join
                  </button>
                </>
              ) : mine?.status === 'pending' ? (
                <p className={styles.notice}>
                  Your request is with the host.{' '}
                  <button
                    className={`${styles.button} ${styles.secondary}`}
                    onClick={() => void refresh()}
                  >
                    Check status
                  </button>
                </p>
              ) : null}
              {accepted && detailFor !== selected.id && (
                <p className={styles.small}>Loading your circle…</p>
              )}
              {accepted && detailFor === selected.id && (
                <>
                  <h3>Travelers</h3>
                  <div className={styles.list}>
                    {members
                      .filter((member) => member.status === 'accepted' || host)
                      .map((member) => (
                        <div key={member.user_id} className={styles.item}>
                          <strong>
                            {member.user_id === user?.id
                              ? 'You'
                              : profiles[member.user_id]?.display_name ||
                                'Member'}
                          </strong>
                          <p className={styles.small}>
                            {profiles[member.user_id]?.home_city}
                            {profiles[member.user_id]?.interests?.length
                              ? ` · ${profiles[member.user_id].interests.join(', ')}`
                              : ''}
                          </p>
                          {host && member.status === 'pending' && (
                            <div className={styles.row}>
                              <span className={styles.tag}>Wants to join</span>
                              <button
                                className={styles.button}
                                disabled={busy}
                                onClick={() => {
                                  if (client)
                                    void action(
                                      () =>
                                        client
                                          .from('circle_members')
                                          .update({ status: 'accepted' })
                                          .eq('circle_id', selected.id)
                                          .eq('user_id', member.user_id),
                                      'Request accepted. This traveler can now join the conversation.',
                                    );
                                }}
                              >
                                Accept
                              </button>
                              <button
                                className={`${styles.button} ${styles.secondary}`}
                                disabled={busy}
                                onClick={() => {
                                  if (client)
                                    void action(
                                      () =>
                                        client
                                          .from('circle_members')
                                          .delete()
                                          .eq('circle_id', selected.id)
                                          .eq('user_id', member.user_id),
                                      'Request declined.',
                                    );
                                }}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  <h3 className={styles.item}>The conversation</h3>
                  <p className={styles.small}>
                    Visible to accepted circle members. Checks for new messages
                    every 15 seconds.
                  </p>
                  <div
                    className={styles.chat}
                    aria-label="Circle messages"
                    aria-live="polite"
                  >
                    {messages.length === 0 ? (
                      <p className={styles.muted}>
                        Make the first introduction.
                      </p>
                    ) : (
                      messages.map((message) => (
                        <div className={styles.message} key={message.id}>
                          <span className={styles.small}>
                            {message.user_id === user?.id
                              ? 'You'
                              : profiles[message.user_id]?.display_name ||
                                'Member'}{' '}
                            · {date(message.created_at)}
                          </span>
                          <p>{message.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    className={styles.form}
                    onSubmit={async (event) => {
                      event.preventDefault();
                      if (!client || !user || !body.trim()) return;
                      await action(async () => {
                        const result = await client
                          .from('circle_messages')
                          .insert({
                            circle_id: selected.id,
                            user_id: user.id,
                            body: body.trim(),
                          });
                        if (!result.error) setBody('');
                        return result;
                      }, 'Message sent.');
                    }}
                  >
                    <label>
                      Your message
                      <textarea
                        required
                        maxLength={2000}
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="Introduce yourself or share a plan…"
                      />
                    </label>
                    <button
                      className={styles.button}
                      disabled={busy || !body.trim()}
                    >
                      Send to circle
                    </button>
                  </form>
                </>
              )}
              {user && mine && !host && (
                <button
                  className={`${styles.button} ${styles.secondary}`}
                  disabled={busy}
                  onClick={() => {
                    if (client)
                      void action(
                        () =>
                          client
                            .from('circle_members')
                            .delete()
                            .eq('circle_id', selected.id)
                            .eq('user_id', user.id),
                        mine.status === 'pending'
                          ? 'Your request was withdrawn.'
                          : 'You have left this circle.',
                      );
                  }}
                >
                  {mine.status === 'pending'
                    ? 'Withdraw request'
                    : 'Leave circle'}
                </button>
              )}
            </section>
          )}
          {!selected && !offerRequest && (
            <section className={styles.card}>
              <span className={styles.eyebrow}>
                The beginning of a great story
              </span>
              <h2>One shared interest is all it takes.</h2>
              <p className={styles.muted}>
                An art weekend. A regatta. A table you have always wanted to
                book. Start a small circle and see who shares your curiosity.
              </p>
              <p className={styles.small}>
                Hosts approve membership. Conversations stay within accepted
                circles. Travel arrangements are confirmed separately with
                providers.
              </p>
            </section>
          )}
        </aside>
      </div>
      {loading && <p className={styles.small}>Checking your membership…</p>}
    </PlatformShell>
  );
}
