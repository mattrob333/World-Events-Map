'use client';

import Link from 'next/link';
import { Button, EmptyState, Panel } from '@/components/ui';
import {
  TRAVELER_FIXTURE_DISCLOSURE,
  TRAVELER_PORTRAITS,
  getTraveler,
} from '@/lib/travelers';
import { Avatar } from '@/components/social';
import { track } from '@/lib/analytics';
import { useEffect } from 'react';

export function PeopleDirectory() {
  return (
    <main className="px-4 py-10 sm:px-8">
      <p className="eyebrow">People</p>
      <h1 className="mt-3 font-display text-5xl text-ink">Travelers</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-6 text-ink-muted">
        Profiles are travel identity, not account settings. Public traveler profiles are not open yet. Profiles are private by default and discovery is opt-in.
      </p>
      <p role="note" className="notice mt-5 max-w-3xl">{TRAVELER_FIXTURE_DISCLOSURE}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TRAVELER_PORTRAITS.map((portrait) => (
          <Link
            key={portrait.person.handle}
            href={`/people/${portrait.person.handle}`}
            className="surface group flex flex-col gap-4 p-5 transition-[transform,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-surface-3 hover:shadow-[var(--shadow-soft-2)] active:translate-y-px active:shadow-[var(--shadow-inset)] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
          >
            <div className="flex items-center gap-3">
              <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={52} />
              <div>
                <p className="font-display text-[22px] leading-tight text-ink">{portrait.person.displayName}</p>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  @{portrait.person.handle} · {portrait.person.homeLabel}
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-6 text-ink-soft">{portrait.philosophy}</p>
            <p className="mt-auto flex flex-wrap gap-1.5">
              {portrait.featuredModes.map((mode) => (
                <span key={mode} className="tag">{mode}</span>
              ))}
            </p>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-[14px] text-ink-muted">
        Signed-in members still edit their private record in{' '}
        <Link href="/account" className="text-brass-bright underline underline-offset-4">
          Account
        </Link>
.
      </p>
    </main>
  );
}

export function TravelerProfile({ handle }: { handle: string }) {
  const portrait = getTraveler(handle);

  useEffect(() => {
    if (portrait) track('profile_opened', { handle });
  }, [handle, portrait]);

  if (!portrait) {
    return (
      <main className="px-4 py-16">
        <EmptyState
          title="No editorial portrait with that handle."
          body="These are example portraits, not real members."
          action={
            <Link href="/people" className="btn btn-ghost">
              Traveler directory
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="px-4 py-10 sm:px-8">
      <p role="note" className="notice">{TRAVELER_FIXTURE_DISCLOSURE}</p>
      <header className="surface-hero mt-6 flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:p-8">
        <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={92} />
        <div>
          <p className="eyebrow">@{portrait.person.handle}</p>
          <h1 className="mt-2 font-display text-5xl text-ink">{portrait.person.displayName}</h1>
          <p className="mt-2 text-[14px] text-ink-muted">
            {portrait.person.homeLabel} · coarse home base only
          </p>
        </div>
      </header>
      <p className="mt-10 max-w-2xl font-display text-2xl leading-snug text-ink">
        {portrait.philosophy}
      </p>
      <Button className="mt-6 min-h-11" variant="ghost" disabled title="Live connections are not enabled on fixture portraits.">
        Connect
      </Button>
      <p className="mt-2 text-[12px] text-ink-subtle">
        Connect stays disabled here so a preview portrait cannot be treated as a real person.
      </p>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Panel title="Featured travel modes">
          {portrait.featuredModes.map((mode) => (
            <p key={mode} className="py-1 text-[14px] text-ink">
              {mode}
            </p>
          ))}
        </Panel>
        <Panel title="Interests">
          {portrait.interests.map((interest) => (
            <p key={interest} className="py-1 text-[14px] text-ink">
              {interest}
            </p>
          ))}
        </Panel>
        <Panel title="Favorite places">
          {portrait.favoritePlaces.map((place) => (
            <p key={place} className="py-1 text-[14px] text-ink">
              {place}
            </p>
          ))}
        </Panel>
      </div>
    </main>
  );
}
