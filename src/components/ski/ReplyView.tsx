'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { decodeReply, optionValid } from '@/lib/ski/share';
import { useSkiPlan } from '@/lib/ski/store';
import { Loading, useSkiContext } from './common';
import styles from './ski.module.css';

type Outcome = { kind: 'added'; by: string; count: number } | { kind: 'other-trip' } | { kind: 'broken' };

/** Someone's votes, back from the group chat: added to the trip planned on this phone. */
export function ReplyView() {
  const context = useSkiContext();
  const importReply = useSkiPlan((state) => state.importReply);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (!context || done.current) return;
    done.current = true;
    const { data } = context;
    const known = (level: string, id: string) => (level === 'range' ? data.rangeById.has(id) : data.resortById.has(id));
    const valid = (key: string) => optionValid(key, 'range', known) || optionValid(key, 'resort', known) || optionValid(key, 'week', known);
    const reply = decodeReply(new URLSearchParams(location.hash.slice(1)).get('r') ?? '', valid);
    // The votes are in the store now: take them out of the address bar so a refresh doesn't re-read them.
    history.replaceState(null, '', location.pathname);
    window.setTimeout(() => {
      if (!reply) setOutcome({ kind: 'broken' });
      else if (importReply(reply)) setOutcome({ kind: 'added', by: reply.by, count: Object.keys(reply.votes).length });
      else setOutcome({ kind: 'other-trip' });
    }, 0);
  }, [context, importReply]);
  if (!context || !outcome) return <Loading />;
  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <div className={styles.kicker}>Votes</div>
          <h1>{outcome.kind === 'added' ? `${outcome.by}’s votes are in` : outcome.kind === 'other-trip' ? 'These votes are for another trip' : 'This link didn’t open'}</h1>
          <p className={styles.lead}>
            {outcome.kind === 'added'
              ? `${outcome.count} vote${outcome.count === 1 ? '' : 's'} added to your trip.`
              : outcome.kind === 'other-trip'
                ? 'Vote links count on the phone that planned the trip. Open it there.'
                : 'It may have been cut off when it was copied. Ask them to send it again.'}
          </p>
        </header>
        <Link className={styles.primary} href="/ski/trip">See your trip</Link>
      </div>
    </div>
  );
}
