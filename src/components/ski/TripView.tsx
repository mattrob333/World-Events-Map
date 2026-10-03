'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { encodePlan, type Level } from '@/lib/ski/share';
import { standing, tally, useSkiPlan } from '@/lib/ski/store';
import { formatSpan, monthsLabel } from '@/lib/ski/window';
import { Loading, optionLabel, useShare, useSkiContext } from './common';
import styles from './ski.module.css';

const LEVELS: { level: Level; title: string; ask: string }[] = [
  { level: 'range', title: 'Mountain ranges', ask: 'Which mountains?' },
  { level: 'resort', title: 'Resorts', ask: 'Which resort?' },
  { level: 'week', title: 'Weeks', ask: 'Which week works?' },
];

/**
 * Your trip: the shortlist at every level, how the votes are going, and a
 * share link for whichever level you want the group to decide next.
 */
export function TripView() {
  const context = useSkiContext();
  const plan = useSkiPlan();
  const { share, toast } = useShare();
  const router = useRouter();
  const [from, setFrom] = useState('');
  const [paste, setPaste] = useState('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  if (!context) return <Loading />;
  const { data, window } = context;
  const voters = Object.keys(plan.votes);
  const anything = plan.picks.range.length + plan.picks.resort.length + plan.picks.week.length + plan.picks.scene.length > 0;

  const shareLevel = (level: Level, ask: string) => {
    const id = plan.ensureId();
    const code = encodePlan({ id, name: plan.name, window, party: plan.party, level, options: plan.picks[level], from: from.trim() });
    void share(`${location.origin}/ski/vote#p=${code}`, `${plan.name}: ${ask} Tap to vote.`);
  };
  const openPaste = () => {
    const hash = paste.trim().split('#')[1] ?? '';
    if (!paste.includes('/ski/reply#')) return setPasteNote('That isn’t a vote link. It should have /ski/reply in it.');
    router.push(`/ski/reply#${hash}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <Link className={styles.back} href="/ski">← Keep exploring</Link>
          <div className={styles.kicker}>Your trip</div>
          <label className={styles.field} style={{ marginTop: 4 }}>
            Trip name
            <input value={plan.name} maxLength={60} onChange={(event) => plan.setName(event.target.value)} />
          </label>
          <p className={styles.lead}>{formatSpan(window.from, window.to)} · {window.nights} nights · {plan.party === 'family' ? 'Families with kids' : 'Adults'}</p>
        </header>

        {!anything && (
          <div className={styles.empty}>Nothing on your shortlist yet. Tap Shortlist on a range, a resort, a week or something to do, and it lands here.</div>
        )}

        {anything && (
          <label className={styles.field}>
            Your name, so they know who sent it (optional)
            <input value={from} maxLength={40} placeholder="Matt" onChange={(event) => setFrom(event.target.value)} />
          </label>
        )}

        {LEVELS.map(({ level, title, ask }) => {
          // Most loved first, so the group's favorite is on top.
          const keys = [...plan.picks[level]].sort((a, b) => standing(plan.votes, b) - standing(plan.votes, a));
          if (!keys.length) return null;
          return (
            <section key={level} className={styles.level}>
              <div className={styles.levelHead}>
                <h2>{title}</h2>
                <button type="button" className={styles.primary} onClick={() => shareLevel(level, ask)} disabled={keys.length < 1}>Share to vote</button>
              </div>
              <div className={styles.options}>
                {keys.map((key) => {
                  const label = optionLabel(data, level, key, window.nights);
                  if (!label) return null;
                  const count = tally(plan.votes, key);
                  return (
                    <div key={key} className={styles.option}>
                      <div>
                        <Link href={label.href}>{label.title}</Link>
                        <p>{label.sub}</p>
                      </div>
                      <button type="button" className={styles.thumbSmall} onClick={() => plan.togglePick(level, key)} aria-label={`Remove ${label.title}`}>Remove</button>
                      {count.total > 0 && <div className={styles.tally}>{count.love > 0 && count.no === 0 && keys[0] === key ? <strong>Top pick</strong> : null}<span>❤ {count.love}</span><span>👍 {count.fine}</span><span>✕ {count.no}</span></div>}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {plan.picks.scene.length > 0 && (
          <section className={styles.level}>
            <div className={styles.levelHead}><h2>Things to do</h2></div>
            <div className={styles.options}>
              {plan.picks.scene.map((id) => {
                const item = data.sceneById.get(id);
                const resort = item && data.resortById.get(item.resortId);
                if (!item || !resort) return null;
                return (
                  <div key={id} className={styles.option}>
                    <div>
                      <Link href={`/ski/resort/${resort.id}`}>{item.name}</Link>
                      <p>{resort.name} · {item.dates ? formatSpan(item.dates.start, item.dates.end) : monthsLabel(item.months)}</p>
                    </div>
                    <button type="button" className={styles.thumbSmall} onClick={() => plan.togglePick('scene', id)} aria-label={`Remove ${item.name}`}>Remove</button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {anything && (
          <section className={styles.level}>
            <div className={styles.levelHead}><h2>Votes</h2></div>
            {voters.length ? (
              <div className={styles.options}>
                {voters.map((voter) => (
                  <div key={voter} className={styles.option}>
                    <div><strong>{voter}</strong><p>{Object.keys(plan.votes[voter]).length} vote{Object.keys(plan.votes[voter]).length === 1 ? '' : 's'}</p></div>
                    <button type="button" className={styles.thumbSmall} onClick={() => plan.clearVotes(voter)}>Remove</button>
                  </div>
                ))}
              </div>
            ) : <p className={styles.note} style={{ marginTop: 8 }}>When someone votes, they get a link to send back. Open it on this phone and their votes show up here.</p>}
            <label className={styles.field}>
              Got a vote link in a chat? Paste it here
              <input value={paste} onChange={(event) => { setPaste(event.target.value); setPasteNote(null); }} placeholder="https://…/ski/reply#…" />
            </label>
            <div className={styles.heroActions}><button type="button" className={styles.secondary} onClick={openPaste} disabled={!paste.trim()}>Add their votes</button></div>
            {pasteNote && <p className={styles.note} role="alert">{pasteNote}</p>}
          </section>
        )}

        {anything && (
          <p className={styles.note} style={{ marginTop: 18 }}>
            Your shortlist is saved on this phone. Vote links carry only the trip name, your dates and the options, never anything from your profile.{' '}
            <button type="button" className={styles.thumbSmall} onClick={() => { if (confirm('Start over? Your shortlist and votes on this phone will be cleared.')) plan.reset(); }}>Start over</button>
          </p>
        )}
      </div>
      {toast}
    </div>
  );
}
