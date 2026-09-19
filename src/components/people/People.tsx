'use client';

import Link from 'next/link';
import { Button, EmptyState, Panel } from '@/components/ui';
import { FixtureBanner } from '@/components/shell';
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
      <p className="label-sm text-brass">People</p>
      <h1 className="mt-2 font-display text-5xl text-ink">Travelers</h1>
      <p className="mt-3 max-w-xl text-[14px] text-ink-muted">
        Profiles are travel identity, not account settings. Live public profiles stay behind PR #8 until the privacy findings are fixed.
      </p>
      <div className="mt-4">
        <FixtureBanner>{TRAVELER_FIXTURE_DISCLOSURE}</FixtureBanner>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TRAVELER_PORTRAITS.map((portrait) => (
          <Link
            key={portrait.person.handle}
            href={`/people/${portrait.person.handle}`}
            className="glass flex flex-col gap-4 rounded-[3px] p-5"
          >
            <div className="flex items-center gap-3">
              <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={52} />
              <div>
                <p className="text-[16px] text-ink">{portrait.person.displayName}</p>
                <p className="text-[12px] text-ink-muted">
                  @{portrait.person.handle} · {portrait.person.homeLabel}
                </p>
              </div>
            </div>
            <p className="text-[13px] leading-5 text-ink-muted">{portrait.philosophy}</p>
            <p className="label-sm text-brass">{portrait.featuredModes.join(' · ')}</p>
          </Link>
        ))}
      </div>
      <p className="mt-10 text-[13px] text-ink-muted">
        Signed-in members still edit their private record in{' '}
        <Link href="/account" className="text-brass">
          Profile
        </Link>
        . Explore affinity in{' '}
        <Link href="/constellation" className="text-brass">
          Constellation
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
          body="These pages are fixture identity surfaces. They are not live member records."
          action={
            <Link href="/people" className="text-brass">
              Traveler directory
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <main className="px-4 py-10 sm:px-8">
      <FixtureBanner>{TRAVELER_FIXTURE_DISCLOSURE}</FixtureBanner>
      <header className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <Avatar seed={portrait.person.avatarSeed} name={portrait.person.displayName} size={92} />
        <div>
          <p className="label-sm text-ink-muted">@{portrait.person.handle}</p>
          <h1 className="font-display text-5xl text-ink">{portrait.person.displayName}</h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            {portrait.person.homeLabel} · coarse home base only
          </p>
        </div>
      </header>
      <p className="mt-8 max-w-2xl font-display text-2xl leading-snug text-ink">
        {portrait.philosophy}
      </p>
      <Button className="mt-6" variant="ghost" disabled title="Live connections are not enabled on fixture portraits.">
        Connect
      </Button>
      <p className="mt-2 text-[11px] text-ink-faint">
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
