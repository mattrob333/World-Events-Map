'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatTicket } from '@/lib/ski/match';
import { decodePlan, encodeReply, type SharedPlan, type VoteValue } from '@/lib/ski/share';
import { useSkiPlan } from '@/lib/ski/store';
import { PASS_LABEL } from '@/lib/ski/types';
import { formatSpan } from '@/lib/ski/window';
import { Loading, optionLabel, useHashParam, useShare, useSkiContext } from './common';
import styles from './ski.module.css';

const CHOICES: { value: VoteValue; label: string }[] = [
  { value: 1, label: '❤ Love it' },
  { value: 0, label: '👍 Fine' },
  { value: -1, label: '✕ Not for us' },
];

/**
 * What someone sees when a ski plan is shared with them: the options, a vote
 * on each, and a link to send their votes back to the group chat. No account,
 * nothing stored on a server.
 */
export function VoteView() {
  const context = useSkiContext();
  const setWindow = useSkiPlan((state) => state.setWindow);
  const { share, toast } = useShare();
  const hash = useHashParam('p');
  const [votes, setVotes] = useState<Record<string, VoteValue>>({});
  const [by, setBy] = useState('');
  if (!context || hash === null) return <Loading />;
  const { data } = context;
  const known = (level: string, id: string) => (level === 'range' ? data.rangeById.has(id) : data.resortById.has(id));
  const plan: SharedPlan | null = decodePlan(hash, known);
  if (!plan) {
    return (
      <div className={styles.page}><div className={styles.wrap}>
        <header className={styles.head}>
          <div className={styles.kicker}>Ski trip</div>
          <h1>This link didn’t open</h1>
          <p className={styles.lead}>It may have been cut off when it was copied. Ask for it again, or start your own plan.</p>
        </header>
        <Link className={styles.primary} href="/ski">Plan a ski trip</Link>
      </div></div>
    );
  }
  const name = by.trim();
  const voted = Object.keys(votes).length;
  const sendBack = () => {
    const code = encodeReply({ tripId: plan.id, by: name, votes });
    void share(`${location.origin}/ski/reply#r=${code}`, `${name}’s votes for ${plan.name}:`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <div className={styles.kicker}>{plan.from ? `${plan.from} is planning` : 'You’re invited to plan'}</div>
          <h1>{plan.name}</h1>
          <p className={styles.lead}>{formatSpan(plan.window.from, plan.window.to)} · {plan.window.nights} nights. Vote on each option, then send your votes back.</p>
        </header>

        <div className={styles.options}>
          {plan.options.map((key) => {
            const label = optionLabel(data, plan.level, key, plan.window.nights);
            if (!label) return null;
            const resort = plan.level !== 'range' ? data.resortById.get(key.split('@')[0]) : undefined;
            const range = plan.level === 'range' ? data.rangeById.get(key) : undefined;
            const ticket = resort ? formatTicket(resort) : null;
            return (
              <div key={key} className={styles.option}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Link href={label.href}>{label.title}</Link>
                  <p>{label.sub}</p>
                  <p>{range?.summary ?? resort?.summary}</p>
                  {resort && <p>{ticket ? `Lift tickets ${ticket} a day` : 'Lift prices not posted yet'}{resort.passes.length ? ` · ${resort.passes.map((pass) => PASS_LABEL[pass]).join(', ')}` : ''}</p>}
                </div>
                <div className={styles.votes} role="group" aria-label={`Your vote on ${label.title}`}>
                  {CHOICES.map((choice) => (
                    <button key={choice.value} type="button" className={styles.vote} aria-pressed={votes[key] === choice.value} onClick={() => setVotes({ ...votes, [key]: choice.value })}>{choice.label}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <label className={styles.field}>
          Who’s voting?
          <input value={by} maxLength={40} placeholder="The Parks" onChange={(event) => setBy(event.target.value)} />
        </label>
        <div className={styles.heroActions}>
          <button type="button" className={styles.primary} disabled={!name || !voted} onClick={sendBack}>Send my votes back</button>
          <Link className={styles.secondary} href="/ski" onClick={() => setWindow(plan.window)}>Explore these dates</Link>
        </div>
        <p className={styles.note} style={{ marginTop: 10 }}>
          {!voted ? 'Vote on at least one option. ' : !name ? 'Add your name so they know whose votes these are. ' : ''}
          Sending makes a link with your votes. Paste it into the group chat and the planner taps it to count them.
        </p>
      </div>
      {toast}
    </div>
  );
}

