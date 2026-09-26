'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TravelCardView } from '@/components/people/TravelCardView';
import styles from '@/components/people/people.module.css';
import { decodeInvite, type GroupInvite } from '@/lib/travelers/groups';
import { AddToGroup } from './AddToGroup';

/** Opens an "add group" link (`/vibe/group#g=…`). Read in the browser only; the fragment never reaches a server. */
export function GroupReceive() {
  const [invite, setInvite] = useState<GroupInvite | null | 'none'>(null);

  useEffect(() => {
    const read = () => setInvite(decodeInvite(new URLSearchParams(window.location.hash.slice(1)).get('g') ?? '') ?? 'none');
    const timer = window.setTimeout(read, 0);
    window.addEventListener('hashchange', read);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', read);
    };
  }, []);

  if (invite === null) return <main className={styles.page} />;
  if (invite === 'none') {
    return (
      <main className={styles.page}>
        <p className={styles.kicker}>Travel together</p>
        <h1 className="mt-3 font-display text-4xl text-ink">This group link didn’t come through whole.</h1>
        <p className={styles.lede}>Ask them to send it again. Links sometimes get cut off when they’re pasted.</p>
        <div className={styles.actions}><Link href="/vibe" className="btn btn-ghost">Your travelers</Link></div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <p className={styles.kicker}>Travel together</p>
      <h1 className="mt-3 font-display text-4xl text-ink">Plan a trip with {invite.name}.</h1>
      <p className={styles.lede}>Here’s what each of them loves. Add them to a group and every trip idea plans around all of you.</p>
      <div className={`${styles.grid} mt-6`}>
        {invite.cards.map((card) => <TravelCardView key={`${card.name}|${card.hometown ?? ''}`} card={card} />)}
      </div>
      <AddToGroup cards={invite.cards} theirName={invite.name} />
    </main>
  );
}
