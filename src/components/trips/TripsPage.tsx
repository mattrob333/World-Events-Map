'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { SignInCard } from '@/components/community/PlatformShell';
import { formatDateRange } from '@/components/ui/tokens';
import { useIntentStore, type IntentRecord } from '@/lib/intent';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import { circleInviteUrl } from '@/lib/trips/circleInvite';
import { clearSkiDrafts, skiDraftKey } from '@/lib/trips/skiDraft';
import { TRIP_ROOM_FIXTURES } from '@/lib/trips';
import { EVENT_INDEX } from '@/lib/data/events';
import { useHydrated } from '@/components/designer/useHydrated';
import { createFamilySkiCircle as runFamilySkiCreation } from './createFamilySkiCircle';
import {
  buildPrivateSkiBrief,
  localToday,
  validateFamilySkiInput,
  type FamilySkiInput,
  type SkiRegion,
  type SkiStay,
} from './familySki';
import styles from './trips.module.css';

type CreatedCircle = { href: string; briefSaved: boolean; brief: string | null };

const DRAFT_FIELDS = ['region', 'start', 'end', 'origin', 'adults', 'children', 'anotherFamily', 'stay', 'nightlyBudget', 'resorts', 'childNotes'] as const;

function readSkiInput(form: HTMLFormElement): FamilySkiInput {
  const data = new FormData(form);
  return {
    region: String(data.get('region')) as SkiRegion,
    start: String(data.get('start') ?? ''),
    end: String(data.get('end') ?? ''),
    origin: String(data.get('origin') ?? '').slice(0, 120),
    adults: Number(data.get('adults')),
    children: Number(data.get('children')),
    anotherFamily: data.get('anotherFamily') === 'on',
    stay: String(data.get('stay')) as SkiStay,
    nightlyBudget: String(data.get('nightlyBudget') ?? ''),
    resorts: String(data.get('resorts') ?? '').slice(0, 160),
    childNotes: String(data.get('childNotes') ?? '').slice(0, 200),
  };
}

export function TripsPage({ featuredSki = false, eventId = '' }: { featuredSki?: boolean; eventId?: string }) {
  const auth = usePlatformAuth();
  const [signOutVersion, setSignOutVersion] = useState(0);
  useEffect(() => {
    if (!auth.client) return;
    const { data } = auth.client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearSkiDrafts();
        setSignOutVersion((version) => version + 1);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [auth.client]);
  // Every field and result in the planner belongs to one account session.
  // A new account, a sign-out (even followed by the same account), or initial
  // auth resolution remounts it cleanly.
  const ownerKey = `${auth.loading ? 'checking-session' : auth.user?.id ?? 'visitor'}:${signOutVersion}`;
  return <TripsPageContent key={ownerKey} featuredSki={featuredSki} eventId={eventId} auth={auth} />;
}

function TripsPageContent({ featuredSki, eventId, auth }: { featuredSki: boolean; eventId: string; auth: ReturnType<typeof usePlatformAuth> }) {
  const storedItems = useIntentStore((state) => state.items);
  // Saved places live on this device: render them after hydration so the server
  // markup (which cannot see them) matches the first client render.
  const hydrated = useHydrated();
  const items = hydrated ? storedItems : [];
  const { client, user, loading } = auth;
  const previewOnly = !loading && !client;
  const linkedEvent = eventId ? EVENT_INDEX.get(eventId) : undefined;
  const [showSkiPlanner, setShowSkiPlanner] = useState(featuredSki || Boolean(linkedEvent));
  const [today] = useState(localToday);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [touched, setTouched] = useState(false);
  const [liveProblem, setLiveProblem] = useState<string | null>(null);
  const [copiedBrief, setCopiedBrief] = useState<{ text: string; copied: boolean } | null>(null);
  const draftKey = skiDraftKey(user?.id);
  const prefillDates = linkedEvent && linkedEvent.start >= today ? { start: linkedEvent.start, end: linkedEvent.end } : null;
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedCircle | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [authChanged, setAuthChanged] = useState(false);
  const authEpoch = useRef(0);
  const saved = items.filter((item) => item.verb === 'save');
  const watched = items.filter((item) => item.verb === 'watch');
  const going = items.filter((item) => item.verb === 'idGo');
  const returnList = [...watched, ...going];
  // When something is kept, the trail leads and the ski CTA steps down from the
  // gradient (UFR2-J04). A ski deep link keeps the planner as the point of the visit.
  const hasTrail = saved.length + returnList.length > 0 && !featuredSki && !linkedEvent;

  useEffect(() => {
    if (!client) return;
    const ownerId = user?.id ?? null;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if ((session?.user?.id ?? null) !== ownerId) {
        authEpoch.current += 1;
        setAuthChanged(true);
      }
    });
    return () => {
      authEpoch.current += 1;
      data.subscription.unsubscribe();
    };
  }, [client, user?.id]);

  useEffect(() => {
    // A visitor draft never carries over into a member's session.
    if (!user) return;
    try {
      window.sessionStorage.removeItem(skiDraftKey(null));
    } catch {
      // Storage unavailable.
    }
  }, [user]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    let draft: Record<string, string | boolean> | null = null;
    try {
      draft = JSON.parse(window.sessionStorage.getItem(draftKey) ?? 'null');
    } catch {
      draft = null;
    }
    if (!draft) return;
    for (const name of DRAFT_FIELDS) {
      const field = form.elements.namedItem(name);
      const value = draft[name];
      if (field instanceof HTMLInputElement && field.type === 'checkbox') field.checked = value === true;
      else if ((field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) && typeof value === 'string') field.value = value;
    }
  }, [draftKey, showSkiPlanner]);

  function rememberDraft(form: HTMLFormElement) {
    const input = readSkiInput(form);
    try {
      window.sessionStorage.setItem(draftKey, JSON.stringify({ ...input, adults: String(input.adults), children: String(input.children) }));
    } catch {
      // Storage unavailable: the form still works, it just won't survive a reload.
    }
    const problem = input.start && input.end ? validateFamilySkiInput(input, today) : null;
    setLiveProblem(problem);
  }

  async function copyBrief() {
    const form = formRef.current;
    if (!form) return;
    setTouched(true);
    const input = readSkiInput(form);
    const problem = validateFamilySkiInput(input, today);
    if (problem) {
      setLiveProblem(problem);
      return;
    }
    const text = buildPrivateSkiBrief(input);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      copied = false;
    }
    setCopiedBrief({ text, copied });
  }

  function revealSkiPlanner() {
    setShowSkiPlanner(true);
    window.setTimeout(() => document.getElementById('family-ski')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function createFamilySkiCircle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCopyStatus('');
    if (!client || !user || authChanged) {
      setError('Sign in to create a shared trip room.');
      return;
    }
    const input = readSkiInput(event.currentTarget);
    const problem = validateFamilySkiInput(input, today);
    if (problem) {
      setError(problem);
      return;
    }
    setCreating(true);
    const epoch = authEpoch.current;
    const isCurrent = () => authEpoch.current === epoch;
    try {
      const outcome = await runFamilySkiCreation(input, user.id, {
        isCurrent,
        createCircle: async (publicCircle) => {
          const result = await client.from('circles').insert(publicCircle).select('id').single();
          if (result.error) throw result.error;
          if (typeof result.data?.id !== 'string') throw new Error('The trip was created, but its link could not be returned. Check Community before trying again.');
          return result.data.id;
        },
        verifyOwner: async () => {
          const result = await client.auth.getUser();
          return !result.error && result.data.user?.id === user.id;
        },
        savePrivateBrief: async (circleId, brief) => {
          const result = await client.from('circle_messages').insert({ circle_id: circleId, user_id: user.id, body: brief });
          if (result.error) throw result.error;
        },
      });
      if (!isCurrent() || outcome.kind === 'stale') return;
      if (outcome.kind === 'failed') throw outcome.error;
      const href = circleInviteUrl(window.location.origin, outcome.circleId);
      if (!href) throw new Error('The trip was created, but its link was invalid. Check Community before trying again.');
      setCreated({ href, briefSaved: outcome.kind === 'created', brief: outcome.kind === 'brief-failed' ? outcome.brief : null });
      clearSkiDrafts();
      if (outcome.kind === 'brief-failed') setError('Your Circle was created, but the private planning brief could not be saved. Open the Circle and post the brief below in its conversation.');
    } catch (cause) {
      if (isCurrent()) setError(cause instanceof Error ? cause.message : 'Could not create this trip. Please try again.');
    } finally {
      if (isCurrent()) setCreating(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    const epoch = authEpoch.current;
    try {
      await navigator.clipboard.writeText(created.href);
      if (authEpoch.current === epoch) setCopyStatus('Link copied. Your friend will sign in, request to join, and wait for your approval.');
    } catch {
      if (authEpoch.current === epoch) setCopyStatus('Select and copy the link below to share it.');
    }
  }

  return (
    <main className={styles.page}>
      {/* A traveler who kept something comes here to find it: it leads (UFR2-J04). */}
      {hasTrail && <div className={styles.trailLead}><YourTrail saved={saved} returnList={returnList} lead /></div>}
      <section className={styles.hero} aria-labelledby="trips-title">
        <div className={styles.heroImage} role="img" aria-label="Julia Mancuso skiing Aspen's World Cup downhill course in 2007" />
        <div className={styles.heroShade} />
        <span className={styles.heroCredit}>Photo, display crop: <a href="https://commons.wikimedia.org/wiki/File:Julia_Mancuso.jpg" target="_blank" rel="noreferrer">Arthur Mouratidis ↗</a> · <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noreferrer">CC BY 2.0</a></span>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>dope.travel / YOUR TRIPS</p>
          <h1 id="trips-title">A place becomes <em>a plan.</em></h1>
          <p className={styles.heroLead}>
            Keep the places that stay with you. Then shape the next trip around the people and moments that matter.
          </p>
          <div className={styles.heroActions}>
            <button type="button" onClick={revealSkiPlanner} className={hasTrail ? styles.secondaryAction : styles.primaryAction}>Start a family ski trip <span aria-hidden="true">↗</span></button>
            <Link href="/trips/designer" className={styles.secondaryAction}>Open the trip designer</Link>
            <a href="#sample-rooms" className={styles.secondaryAction}>Preview a trip room <span aria-hidden="true">↓</span></a>
          </div>
          <p className={styles.heroNote}>Aspen ski archive, 2007. Shared trips require membership; saved places stay on this device.</p>
        </div>
      </section>

      <div className={styles.content}>
        {showSkiPlanner && !authChanged && <section id="family-ski" className={styles.planner} aria-labelledby="family-ski-title">
          <div className={styles.plannerIntro}>
            <p className={styles.eyebrow}>START WITH THE PEOPLE</p>
            <h2 id="family-ski-title">Plan the snow, <em>together.</em></h2>
            {previewOnly ? <>
              {/* No member services: say so before any step, and make the steps the ones that work (UFR2-J05). */}
              <p className={styles.unavailableNote} role="note">
                Shared trip rooms aren&apos;t available on this preview. Nothing you enter is saved on dope.travel, but you can copy your brief and send it to the other family yourself.
              </p>
              <p>Begin with two regions and the shape of your trip. Copy the brief, send it to the other family, and compare towns and stays together.</p>
              <ol>
                <li><span>01</span> Choose a window and what your family needs.</li>
                <li><span>02</span> Copy the trip brief.</li>
                <li><span>03</span> Send it to the other family, then shortlist together.</li>
              </ol>
            </> : <>
              <p>Begin with two regions and the shape of your trip. Create a Circle, send its link to the other family, then use the private conversation to compare towns and stays.</p>
              <ol>
                <li><span>01</span> Choose a window and what your family needs.</li>
                <li><span>02</span> Share the Circle link with your friend.</li>
                <li><span>03</span> Approve their request, then shortlist together.</li>
              </ol>
              <p className={styles.privacyNote}>The Circle name, region, and dates are visible to signed-in members. Household details and budget are posted only to its accepted-member conversation. A link is an invitation to request access, not automatic entry.</p>
            </>}
            <div className={styles.researchState}>
              <p className={styles.eyebrow}>RESEARCH BRIEF / AWAITING CONNECTION</p>
              <p>{previewOnly ? 'Your brief lists' : 'Your Circle records'} what to investigate together. Trip-specific research is awaiting source connections; no result here represents a current quote or available room.</p>
              <dl>
                <div><dt>Snow &amp; forecast</dt><dd>Resort and weather sources pending</dd></div>
                <div><dt>Stays &amp; prices</dt><dd>Lodging inventory and quotes pending</dd></div>
                <div><dt>Articles &amp; social</dt><dd>Article and social sources not connected yet</dd></div>
                <div><dt>Video</dt><dd>YouTube source pending</dd></div>
              </dl>
            </div>
          </div>
          <div className={styles.plannerCard}>
            <p className={styles.eyebrow}>FAMILY SKI TRIP / FIRST DRAFT</p>
            <h3>What should we compare?</h3>
            {linkedEvent && (
              <p className={styles.fieldNote}>Starting from {linkedEvent.name}. Change anything below.</p>
            )}
            <form
              ref={formRef}
              onSubmit={createFamilySkiCircle}
              onChange={(event) => rememberDraft(event.currentTarget)}
              onBlur={() => setTouched(true)}
              className={styles.plannerForm}
            >
              <label>Where are you considering?
                <select name="region" defaultValue="compare">
                  <option value="compare">Compare Colorado Rockies + Swiss Alps</option>
                  <option value="rockies">Colorado Rockies</option>
                  <option value="alps">Swiss Alps</option>
                </select>
              </label>
              <label>Resorts we&apos;re looking at <span className={styles.optional}>(optional)</span>
                <input name="resorts" maxLength={160} defaultValue={linkedEvent?.city ?? ''} placeholder="e.g. Aspen, St. Moritz" />
              </label>
              <div className={styles.formSplit}>
                <label>First day <input type="date" name="start" min={today} defaultValue={prefillDates?.start} required aria-invalid={touched && Boolean(liveProblem && /date|day/.test(liveProblem))} /></label>
                <label>Last day <input type="date" name="end" min={today} defaultValue={prefillDates?.end} required aria-invalid={touched && Boolean(liveProblem && /date|day/.test(liveProblem))} /></label>
              </div>
              <label>Starting from <input name="origin" maxLength={120} placeholder="City or airport" /></label>
              <div className={styles.formSplit}>
                <label>Adults in your household <input type="number" name="adults" min={1} max={16} defaultValue={2} required /></label>
                <label>Children in your household <input type="number" name="children" min={0} max={16} defaultValue={2} required /></label>
              </div>
              <label>Children&apos;s ages and lessons <span className={styles.optional}>(optional, private)</span>
                <input name="childNotes" maxLength={200} placeholder="e.g. 6 and 9, both need ski school" />
              </label>
              <label className={styles.checkLabel}><input type="checkbox" name="anotherFamily" defaultChecked /> We want another family to plan with us</label>
              <label>Top lodging priority
                <select name="stay" defaultValue="slopeside">
                  <option value="slopeside">Ski-in/ski-out</option>
                  <option value="near-lifts">Near the lifts</option>
                  <option value="flexible">Flexible location, better value</option>
                </select>
              </label>
              <label>Combined lodging target per night <span className={styles.optional}>(optional)</span>
                <span className={styles.budgetInput}><span>$</span><input type="number" name="nightlyBudget" min={0} max={100000} step={1} placeholder="Set one together later" /></span>
              </label>
              <p className={styles.fieldNote}>These are planning preferences. Snow, lodging availability, travel times, and prices still need live research and provider confirmation.</p>
              {error && <p role="alert" className={styles.formError}>{error}</p>}
              {!error && touched && liveProblem && <p role="alert" className={styles.formError}>{liveProblem}</p>}
              {client ? (
                <button type="submit" className={styles.submitAction} disabled={creating || loading || !user || Boolean(created) || authChanged}>{creating ? 'Creating your Circle…' : created ? 'Circle created' : 'Create the shared Circle'} <span aria-hidden="true">↗</span></button>
              ) : null}
              <button type="button" onClick={() => void copyBrief()} className={client ? styles.secondaryFormAction : styles.submitAction}>
                Copy our trip brief <span aria-hidden="true">↗</span>
              </button>
            </form>
            {copiedBrief && (
              <div className={styles.created} role="status">
                <p className={styles.eyebrow}>{copiedBrief.copied ? 'BRIEF COPIED' : 'YOUR BRIEF'}</p>
                <p>{copiedBrief.copied ? 'Paste it into a message to the other family.' : 'Select and copy the brief below to send it.'} Nothing was saved on dope.travel.</p>
                <label>Trip brief <textarea readOnly value={copiedBrief.text} onFocus={(event) => event.currentTarget.select()} /></label>
              </div>
            )}
            {!loading && !user && <div className={styles.signIn}><SignInCard /></div>}
            {created && <div className={styles.created} role="status">
              <p className={styles.eyebrow}>YOUR CIRCLE IS READY</p>
              <h4>Bring the other family in.</h4>
              <p>Send this link. Your friend signs in and requests to join; you approve them in the Circle. Only then can they read the planning conversation.</p>
              <label>Circle link <input readOnly value={created.href} onFocus={(event) => event.currentTarget.select()} /></label>
              <div className={styles.createdActions}><button type="button" onClick={() => void copyLink()}>Copy invitation link</button><a href={created.href}>Open your Circle ↗</a></div>
              {copyStatus && <p>{copyStatus}</p>}
              {!created.briefSaved && <label>Private brief to paste in the Circle conversation <textarea readOnly value={created.brief ?? ''} onFocus={(event) => event.currentTarget.select()} /></label>}
            </div>}
          </div>
        </section>}

        <section id="sample-rooms" className={styles.rooms} aria-labelledby="sample-rooms-title">
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.eyebrow}>A GLIMPSE OF WHAT COMES NEXT</p>
              <h2 id="sample-rooms-title">Imagine the trip taking shape.</h2>
            </div>
            <p>Two sample rooms show the shape of group planning. They are previews, not live Circles or confirmed itineraries.</p>
          </div>
          <div className={styles.roomGrid}>
            {TRIP_ROOM_FIXTURES.map((trip) => {
              const aspen = trip.destinationSlug === 'aspen';
              return (
                <div key={trip.id} className={styles.roomFrame}>
                  <Link href={`/circles/${trip.id}`} className={styles.roomCard}>
                    <div className={`${styles.roomImage} ${aspen ? styles.snowScene : styles.seaScene}`} role="img" aria-label={aspen ? 'Fresh snow on Aspen Mountain' : 'A yacht at the 2022 Monaco Yacht Show'}>
                      <span>{aspen ? 'Aspen place archive' : 'Monaco event archive · 2022'}</span>
                    </div>
                    <div className={styles.roomBody}>
                      <div className={styles.roomMeta}><span>Sample trip room</span><span>{trip.travelMode}</span></div>
                      <h3>{trip.name}</h3>
                      <p className={styles.roomDates}>{trip.destinationLabel} · {formatDateRange(trip.start, trip.end)}</p>
                      <p className={styles.roomDecision}>{trip.nextDecision}</p>
                      <span className={styles.roomLink}>See the sample plan <span aria-hidden="true">↗</span></span>
                    </div>
                  </Link>
                  <span className={styles.roomCredit}>Photo, display crop: {aspen ? (
                    <><a href="https://commons.wikimedia.org/wiki/File:Aspen_Mountain_firs_with_fresh_snow.jpg" target="_blank" rel="noreferrer">Wolfgang Moroder ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a></>
                  ) : (
                    <><a href="https://commons.wikimedia.org/wiki/File:MYS_2022_1.jpg" target="_blank" rel="noreferrer">102Legobrick ↗</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></>
                  )}</span>
                </div>
              );
            })}
          </div>
        </section>

        {!hasTrail && <YourTrail saved={saved} returnList={returnList} lead={false} />}
      </div>
    </main>
  );
}

const TRAIL_STATUS: Record<IntentRecord['verb'], string> = { save: 'Saved', watch: 'Watching', idGo: 'I’d go' };

/** "Munich · 19 Sep – 4 Oct 2026 · Saved", with the occasion name as a second line. */
export function trailRow(item: Pick<IntentRecord, 'verb' | 'kind' | 'id' | 'label'>): { line: string; detail?: string } {
  const status = TRAIL_STATUS[item.verb];
  const event = item.kind === 'event' ? EVENT_INDEX.get(item.id) : undefined;
  if (event) return { line: `${event.city} · ${formatDateRange(event.start, event.end)} · ${status}`, detail: event.name };
  return { line: `${item.label} · ${status}` };
}

function TrailList({ items }: { items: IntentRecord[] }) {
  return <ul className={styles.intentList}>{items.map((item) => {
    const row = trailRow(item);
    return <li key={`${item.verb}-${item.kind}-${item.id}`}><Link href={item.href}>
      <span className={styles.intentText}><span>{row.line}</span>{row.detail && <span className={styles.intentDetail}>{row.detail}</span>}</span>
      <span className={styles.intentVerb}>Open <span aria-hidden="true">↗</span></span>
    </Link></li>;
  })}</ul>;
}

function YourTrail({ saved, returnList, lead }: { saved: IntentRecord[]; returnList: IntentRecord[]; lead: boolean }) {
  return (
    <section className={lead ? `${styles.yourTrail} ${styles.yourTrailLead}` : styles.yourTrail} aria-labelledby="your-trail-title">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>YOUR TRAIL</p>
          <h2 id="your-trail-title">{lead ? 'What you kept.' : 'The places you come back to.'}</h2>
        </div>
        <p>These choices are private to this device. Watch is a return list without notifications; I&apos;d go does not match you with travelers yet.</p>
      </div>
      <div className={styles.trailGrid}>
        <section className={styles.trailCard} aria-labelledby="saved-title">
          <div className={styles.trailHeading}><span className={styles.trailIndex}>01</span><h3 id="saved-title">Saved places</h3><span className={styles.count}>{saved.length}</span></div>
          {saved.length ? <TrailList items={saved} /> : (
            <div className={styles.emptyTrail}>
              <p>Nothing here yet. Begin with a place you would make time for.</p>
              <Link href="/">Explore the world <span aria-hidden="true">↗</span></Link>
            </div>
          )}
        </section>
        <section className={styles.trailCard} aria-labelledby="return-title">
          <div className={styles.trailHeading}><span className={styles.trailIndex}>02</span><h3 id="return-title">On your radar</h3><span className={styles.count}>{returnList.length}</span></div>
          {returnList.length ? <TrailList items={returnList} /> : (
            <div className={styles.emptyTrail}>
              <p>Watch a destination when the timing is not quite right, then come back when it is.</p>
              <Link href="/">See what is happening <span aria-hidden="true">↗</span></Link>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
