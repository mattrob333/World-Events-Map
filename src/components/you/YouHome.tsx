'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { bentoCards } from '@/lib/designer/moodboard';
import { pickActiveGroup, useDesignerStore, type SavedProfile } from '@/lib/designer/store';
import { decodeInvite, encodeInvite, groupTravelers, inviteFromGroup, inviteUrl, type GroupInvite, type TravelGroup } from '@/lib/travelers/groups';
import { travelerName } from '@/lib/travelers/names';
import styles from './you.module.css';

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function lovesLine(entry: SavedProfile): string {
  const p = entry.profile;
  return [...(p.artists ?? []), ...p.interests, ...p.food, ...p.teams].slice(0, 4).join(', ');
}

function metaLine(entry: SavedProfile): string {
  const p = entry.profile;
  const age = p.age !== undefined ? (p.age < 18 ? `${p.age}, kid` : String(p.age)) : '';
  return [age, p.hometown].filter(Boolean).join(' · ');
}

/** Reads the `g=` part of a pasted group link (or the bare code). */
export function inviteFromText(text: string): GroupInvite | null {
  const trimmed = text.trim();
  const hash = trimmed.includes('#') ? trimmed.slice(trimmed.indexOf('#') + 1) : trimmed;
  const code = new URLSearchParams(hash).get('g') ?? hash;
  return decodeInvite(code);
}

/**
 * The top of the You tab: your passport, the travelers on this device (a
 * profile per person, each built by talking), and the groups trips are
 * planned for.
 */
export function YouHome({ openId, onOpen, onAddTraveler }: { openId: string | null; onOpen: (id: string) => void; onAddTraveler: () => void }) {
  const profiles = useDesignerStore((state) => state.profiles);
  const meId = useDesignerStore((state) => state.meId);
  const groups = useDesignerStore((state) => state.groups);
  const activeGroupId = useDesignerStore((state) => state.activeGroupId);
  const accountSync = useDesignerStore((state) => state.accountSync);
  const setMe = useDesignerStore((state) => state.setMe);
  const removeProfile = useDesignerStore((state) => state.removeProfile);

  const me = profiles.find((entry) => entry.id === meId) ?? profiles[profiles.length - 1];
  const active = pickActiveGroup(groups, activeGroupId);
  const others = profiles.filter((entry) => entry.id !== me?.id);
  const ordered = me ? [me, ...others] : others;

  return (
    <div className={styles.stack}>
      {me ? (
        <section className={styles.passport} aria-label="Your passport">
          <div className={styles.passportTop}>
            <span className={styles.brand}>Traveler passport</span>
            <span className={styles.brand}>{accountSync ? 'Saved to your account' : 'On this device'}</span>
          </div>
          <div>
            <p className={styles.name}>{travelerName(me)}</p>
            {me.profile.hometown ? <p className={styles.home}>From {me.profile.hometown}</p> : null}
          </div>
          <div className={styles.stats}>
            <span className={styles.stat}><strong>{profiles.length}</strong><span>{profiles.length === 1 ? 'Traveler' : 'Travelers'}</span></span>
            <span className={styles.stat}><strong>{groups.length}</strong><span>Groups</span></span>
            {active ? <span className={styles.stat}><strong>{active.name}</strong><span>Planning for</span></span> : null}
          </div>
          <div className={styles.actions}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(me.id)}>Open your profile</button>
            {!accountSync ? <Link href="/settings" className="btn btn-ghost btn-sm">Keep it with your account</Link> : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="travelers-title">
        <div className={styles.sectionHead}>
          <div>
            <h2 id="travelers-title">Travelers</h2>
            <p className={styles.sub}>A profile for each person. Hand someone the phone and let them talk for a minute about what they love; it plans around all of you.</p>
          </div>
        </div>
        <div className={styles.grid} role="list">
          {ordered.map((entry) => {
            const tile = bentoCards(entry.profile)[0];
            const loves = lovesLine(entry);
            return (
              <div key={entry.id} role="listitem" className={`${styles.traveler} ${entry.id === openId ? styles.travelerOpen : ''}`}>
                <div className={styles.travelerTop}>
                  <span className={styles.avatar} style={{ background: tile ? `linear-gradient(135deg, ${tile.palette[0]}, ${tile.palette[1]})` : 'var(--color-surface-3)' }} aria-hidden="true">
                    {tile?.emoji ?? '✦'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`${styles.travelerName} truncate`}>{travelerName(entry)} {entry.id === me?.id ? <span className={styles.me}>You</span> : null}</p>
                    {metaLine(entry) ? <p className={styles.travelerMeta}>{metaLine(entry)}</p> : null}
                  </div>
                </div>
                <p className={styles.loves}>{loves ? `Loves ${loves}` : 'Nothing picked out yet. Open it and add more by talking.'}</p>
                <div className={styles.actions}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(entry.id)} aria-label={`Open ${travelerName(entry)}’s profile`}>Open</button>
                  {entry.id !== me?.id ? (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMe(entry.id)}>This is me</button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        aria-label={`Delete ${travelerName(entry)}’s profile`}
                        onClick={() => {
                          if (window.confirm(`Delete ${travelerName(entry)}’s profile from this device?`)) removeProfile(entry.id);
                        }}
                      >
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
          <button type="button" className={styles.addTraveler} onClick={onAddTraveler}>
            <span aria-hidden="true">🎙</span>
            <strong>Add a traveler</strong>
            <span>Your partner, a kid, a friend. They talk, we listen.</span>
          </button>
        </div>
      </section>

      <Groups profiles={profiles} />
    </div>
  );
}

function Groups({ profiles }: { profiles: SavedProfile[] }) {
  const groups = useDesignerStore((state) => state.groups);
  const activeGroupId = useDesignerStore((state) => state.activeGroupId);
  const setActiveGroup = useDesignerStore((state) => state.setActiveGroup);
  const active = pickActiveGroup(groups, activeGroupId);
  if (!active) return null;
  return (
    <section aria-labelledby="groups-title">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="groups-title">Groups</h2>
          <p className={styles.sub}>Who’s coming. Trip ideas, Now and the planner work for the group you pick here.</p>
        </div>
      </div>
      <div className={styles.switch} role="group" aria-label="Plan for">
        {groups.map((group) => (
          <button key={group.id} type="button" className="chip" aria-pressed={group.id === active.id} onClick={() => setActiveGroup(group.id)}>
            {group.name}
          </button>
        ))}
      </div>
      <GroupCard key={active.id} group={active} profiles={profiles} />
      <AddGroup />
    </section>
  );
}

function GroupCard({ group, profiles }: { group: TravelGroup; profiles: SavedProfile[] }) {
  const toggle = useDesignerStore((state) => state.toggleGroupMember);
  const removeGuest = useDesignerStore((state) => state.removeGuest);
  const removeGroup = useDesignerStore((state) => state.removeGroup);
  const renameGroup = useDesignerStore((state) => state.renameGroup);
  const setActiveGroup = useDesignerStore((state) => state.setActiveGroup);
  const [status, setStatus] = useState('');
  const travelers = useMemo(() => groupTravelers(group, profiles), [group, profiles]);
  const lead = group.memberIds[0];

  async function share() {
    const invite = inviteFromGroup(group, profiles, travelerName);
    if (!invite.cards.length) {
      setStatus('Add someone with a profile first.');
      return;
    }
    const url = inviteUrl(window.location.origin, invite);
    try {
      if (navigator.share) await navigator.share({ title: `Travel with ${group.name}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setStatus('Link copied. Send it to the family you’re traveling with.');
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return;
      setStatus('Couldn’t copy it. Try again.');
    }
  }

  return (
    <div className={styles.group}>
      <p className={styles.sub}>
        {travelers.length ? `${plural(travelers.length, 'person', 'people')}: ${travelers.map((t) => t.name).join(', ')}.` : 'No one yet. Build your own profile first.'}
      </p>
      {group.kind !== 'solo' ? (
        <div className={styles.who} role="group" aria-label={`Who is in ${group.name}`}>
          {[...profiles].sort((a, b) => Number(b.id === lead) - Number(a.id === lead)).map((entry) => {
            const on = group.memberIds.includes(entry.id);
            const fixed = group.kind !== 'custom' && entry.id === lead;
            return (
              <button key={entry.id} type="button" className={styles.pick} aria-pressed={on} disabled={fixed} onClick={() => toggle(group.id, entry.id)}>
                {on ? '✓ ' : '+ '}{travelerName(entry)}
              </button>
            );
          })}
          {group.guests.map((guest) => (
            <span key={guest.id} className={`${styles.pick} ${styles.guest}`}>
              {guest.card.name}{guest.card.kid ? ' (kid)' : ''}
              <button type="button" className={styles.x} onClick={() => removeGuest(group.id, guest.id)} aria-label={`Remove ${guest.card.name} from ${group.name}`}>×</button>
            </span>
          ))}
        </div>
      ) : null}
      <div className={styles.actions}>
        <Link href={`/trips/designer?group=${encodeURIComponent(group.id)}`} onClick={() => setActiveGroup(group.id)} className="btn btn-primary btn-sm">Plan a trip for {group.name}</Link>
        {group.kind !== 'solo' ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => void share()}>Share this group</button> : null}
        {group.kind === 'custom' ? (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                const name = window.prompt('Name this group', group.name);
                if (name) renameGroup(group.id, name);
              }}
            >
              Rename
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm(`Remove the group ${group.name}?`)) removeGroup(group.id); }}>Remove group</button>
          </>
        ) : null}
      </div>
      {status ? <p className={styles.status} role="status">{status}</p> : null}
      {group.guests.length ? <p className={styles.note}>People added from a link come as travel cards: what they love and how they travel. Their own words stay on their phone.</p> : null}
    </div>
  );
}

function AddGroup() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const invite = text ? inviteFromText(text) : null;
  if (!open) {
    return (
      <div className={`${styles.actions} mt-3`}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>+ Add a group</button>
      </div>
    );
  }
  return (
    <div className={styles.group}>
      <p className={styles.travelerName}>Travel with another family or crew</p>
      <p className={styles.sub}>Ask them to open the You tab, tap Share this group, then open the link they send. Or paste it here.</p>
      <div className={styles.inline}>
        <label htmlFor="group-link" className="sr-only">Group link</label>
        <input id="group-link" className={styles.input} value={text} onChange={(event) => { setText(event.target.value); setError(''); }} placeholder="https://dope.travel/vibe/group#g=…" autoComplete="off" />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (!invite) {
              setError('That link didn’t come through whole. Ask them to send it again.');
              return;
            }
            router.push(`/vibe/group#g=${encodeInvite(invite)}`);
          }}
        >
          Open
        </button>
      </div>
      {error ? <p className={styles.status} role="alert">{error}</p> : null}
    </div>
  );
}
