'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/components/ui';
import { useOnboardingStore } from '@/lib/onboarding';
import { DEMO_LABEL, isDemoMode } from '@/lib/flags';
import dynamic from 'next/dynamic';

// Demo-only social layer: loaded on demand so non-demo builds don't ship it.
const CurrentMemberChip = dynamic(() => import('@/components/social/CurrentMemberChip').then((m) => m.CurrentMemberChip), { ssr: false });
const SocialRoot = dynamic(() => import('@/components/social/MemberProfileSheet').then((m) => m.SocialRoot), { ssr: false });
import { CommandPalette, SearchTrigger } from './CommandPalette';

const PRIMARY = [
  { href: '/', label: 'World' },
  { href: '/circles', label: 'Circles' },
  { href: '/people', label: 'People' },
  { href: '/trips', label: 'Trips' },
  { href: '/access', label: 'Access' },
] as const;

const MOBILE = [
  { href: '/', label: 'World' },
  { href: '/circles', label: 'Circles' },
  { href: '/people', label: 'People' },
  { href: '/access', label: 'Access' },
] as const;

// Phone bottom bar only has five slots. NOW, Trips, and Profile live here
// so they stay reachable without crowding the primary tabs.
const MORE_LINKS = [
  { href: '/now', label: 'Now', hint: "Tonight's scene" },
  { href: '/trips', label: 'Trips', hint: 'Saved, watched, and I’d go' },
  { href: '/trips/designer', label: 'Trip designer', hint: 'Drag, swipe, and vote on a group trip' },
  { href: '/moodboard', label: 'Mood board', hint: 'Talk about you; get a collage' },
  { href: '/account', label: 'Profile', hint: 'Your traveler lens' },
] as const;

function activePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function moreIsActive(pathname: string): boolean {
  return MORE_LINKS.some((item) => activePath(pathname, item.href));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const morePanelId = useId();
  const completed = useOnboardingStore((s) => s.completed);
  const skip = useOnboardingStore((s) => s.skip);

  useEffect(() => setMounted(true), []);
  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const world = pathname === '/';
  const welcome = pathname.startsWith('/welcome');
  // Providers on the partner studio are not being asked about their own travel.
  const showOnboarding = mounted && !completed && !welcome && !pathname.startsWith('/partners');

  return (
    <div className={cn('min-h-dvh bg-void text-ink', world && 'bg-transparent')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:bg-void focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <header className="glass sticky top-0 z-40 border-b border-ink/10">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-3 sm:px-5">
          <Link href="/" className="flex shrink-0 items-baseline" aria-label="dope.travel home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/dope-wordmark.svg" alt="" className="h-[22px] w-auto self-center" />
            <span className="font-display -ml-0.5 text-[13px] italic text-ink-muted" aria-hidden>
              .travel
            </span>
          </Link>
          {isDemoMode() && (
            <span
              className="label-sm shrink-0 border border-signal/40 px-1.5 py-1 text-signal"
              title={DEMO_LABEL}
            >
              Demo · simulated
            </span>
          )}
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {PRIMARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'label px-2.5 py-2 text-ink-muted hover:text-ink',
                  activePath(pathname, item.href) && 'text-brass',
                )}
                aria-current={activePath(pathname, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SearchTrigger />
            {/* Demo only: the member plate mounts the profile sheet, invitations and share links. */}
            {isDemoMode() && <CurrentMemberChip className="hidden sm:flex" mountRoot={false} />}
            <Link
              href="/now"
              className={cn(
                'label hidden px-2 py-2 text-ink-muted hover:text-ink sm:inline',
                pathname.startsWith('/now') && 'text-brass',
              )}
            >
              Now
            </Link>
            <Link
              href="/account"
              className={cn(
                'label px-2 py-2 text-ink-muted hover:text-ink',
                pathname.startsWith('/account') && 'text-brass',
              )}
            >
              Profile
            </Link>
          </div>
        </div>
      </header>
      {/* Outside the glass header: its backdrop-filter would trap the fixed sheet and invitation strip. */}
      {isDemoMode() && <SocialRoot />}

      {showOnboarding && (
        <div className="border-b border-brass/20 bg-brass-wash px-4 py-2 text-[12px] text-brass-bright">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
            <span>Set your traveler lens — it takes under a minute, and you can skip.</span>
            <span className="flex gap-3">
              <Link
                href={`/welcome?from=${encodeURIComponent(pathname)}`}
                className="underline decoration-brass/40 underline-offset-4"
              >
                Begin
              </Link>
              <button type="button" onClick={skip} className="text-ink-muted hover:text-ink">
                Skip
              </button>
            </span>
          </div>
        </div>
      )}

      <div
        id="main"
        className={cn(
          'pb-16 md:pb-0',
          !world && 'mx-auto max-w-[1600px]',
        )}
      >
        {children}
      </div>

      <nav
        aria-label="Mobile primary"
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex h-14 items-center justify-center label-sm text-ink-muted',
                  activePath(pathname, item.href) && 'text-brass',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={cn(
                'flex h-14 w-full items-center justify-center label-sm text-ink-muted',
                (moreOpen || moreIsActive(pathname)) && 'text-brass',
              )}
              aria-expanded={moreOpen}
              aria-controls={morePanelId}
              aria-haspopup="menu"
              aria-label="More"
              onClick={() => setMoreOpen((open) => !open)}
            >
              More
            </button>
          </li>
        </ul>
      </nav>
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close more menu"
            className="fixed inset-x-0 bottom-14 top-0 z-[45] bg-void/50 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id={morePanelId}
            role="menu"
            className="glass-deep fixed inset-x-0 bottom-14 z-50 border-t border-ink/10 px-3 py-3 md:hidden"
          >
            {MORE_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={cn(
                  'flex items-baseline justify-between gap-3 px-3 py-3 text-ink-muted',
                  activePath(pathname, item.href) && 'text-brass',
                )}
              >
                <span className="label">{item.label}</span>
                <span className="text-[12px] text-ink-faint">{item.hint}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      <CommandPalette />
    </div>
  );
}
