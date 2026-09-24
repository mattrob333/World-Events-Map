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
import { SunButton, SunModal } from '@/components/voice/SunModal';
import { ProfileSwitcher } from './ProfileSwitcher';
import { ResumeTrip } from './ResumeTrip';

const PRIMARY = [
  { href: '/', label: 'World' },
  { href: '/circles', label: 'Circles' },
  { href: '/people', label: 'People' },
  { href: '/trips', label: 'Trips' },
  { href: '/access', label: 'Access' },
] as const;

const MOBILE = [
  { href: '/', label: 'World', icon: 'world' },
  { href: '/circles', label: 'Circles', icon: 'circles' },
  { href: '/people', label: 'People', icon: 'people' },
  { href: '/access', label: 'Access', icon: 'access' },
] as const;

type TabIcon = (typeof MOBILE)[number]['icon'] | 'more';

/** Line icons for the phone tab bar: 22px, 1.6 stroke, currentColor. */
function TabGlyph({ name }: { name: TabIcon }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'world':
      return (<svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" /></svg>);
    case 'circles':
      return (<svg {...common}><circle cx="9" cy="12" r="5.5" /><circle cx="15" cy="12" r="5.5" /></svg>);
    case 'people':
      return (<svg {...common}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" /></svg>);
    case 'access':
      return (<svg {...common}><circle cx="8.5" cy="12" r="3.5" /><path d="M12 12h8.5M17.5 12v3M20.5 12v2" /></svg>);
    default:
      return (<svg {...common}><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></svg>);
  }
}

// Phone bottom bar only has five slots. NOW, Trips, and Profile live here
// so they stay reachable without crowding the primary tabs.
const MORE_LINKS = [
  { href: '/now', label: 'Now', hint: "Tonight's scene" },
  { href: '/trips', label: 'Trips', hint: 'Saved, watched, and I’d go' },
  { href: '/trips/designer', label: 'Trip designer', hint: 'Drag, swipe, and vote on a group trip' },
  { href: '/moodboard', label: 'Mood board', hint: 'Talk about you; get your board' },
  { href: '/agents', label: 'Bring your AI', hint: 'Let your agent set you up' },
  { href: '/account', label: 'Profile', hint: 'Your traveler lens' },
] as const;

// Mirrors getPlatformClient(): member services exist only with both public keys.
const MEMBERSHIP_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// Until membership exists, "Profile" is the traveler's on-device mood board,
// not an account page that says "not connected" (UFR2-H16).
const PROFILE_HREF = MEMBERSHIP_CONFIGURED ? '/account' : '/moodboard';
const MORE_ITEMS = MORE_LINKS.filter((item) => MEMBERSHIP_CONFIGURED || item.href !== '/account');

function activePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The one More item for this route: the most specific match, so /trips/designer
 * lights "Trip designer" and not "Trips" too. The header's Profile link already
 * marks its own route, so More stays dark there (UFR2-J10).
 */
export function currentMoreHref(pathname: string, profileHref: string = PROFILE_HREF): string | null {
  const match = MORE_LINKS
    .filter((item) => item.href !== profileHref && activePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? null;
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
  // The lens invitation belongs to the front door only: on every page it pushed
  // content down, and on /moodboard it competed with the board's own flow (UFR2-J13).
  const showOnboarding = mounted && !completed && world;
  const moreHref = currentMoreHref(pathname);
  const profileCurrent = activePath(pathname, PROFILE_HREF);

  return (
    <div className={cn('min-h-dvh bg-void text-ink', world && 'bg-transparent')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:bg-void focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      {/* Opaque: at 90% the page text showed through while scrolling (UFR2-J11). */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-surface-0">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-5">
          <Link href="/" className="flex min-h-11 shrink-0 items-center" aria-label="dope.travel home">
            {/* One drawn lockup, so ".travel" always shares the wordmark's baseline. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/dope-travel-lockup.svg" alt="" width={95} height={32} className="h-8 w-auto" />
          </Link>
          {isDemoMode() && (
            <span
              className="tag shrink-0 text-saffron"
              title={DEMO_LABEL}
            >
              Demo<span className="hidden sm:inline"> · simulated</span>
            </span>
          )}
          <nav aria-label="Primary" className="hidden items-center gap-1 rounded-full bg-surface-1 p-1 shadow-[var(--shadow-inset)] md:flex">
            {PRIMARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium leading-none text-ink-muted transition-colors hover:text-bone',
                  activePath(pathname, item.href) && 'bg-surface-3 text-bone shadow-soft-1',
                )}
                aria-current={activePath(pathname, item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SunButton />
            <SearchTrigger />
            {/* Demo only: the member plate mounts the profile sheet, invitations and share links. */}
            {isDemoMode() && <CurrentMemberChip className="hidden sm:flex" mountRoot={false} />}
            {/* md and up: below that, Now lives in More so one route never lights twice. */}
            <Link
              href="/now"
              aria-current={activePath(pathname, '/now') ? 'page' : undefined}
              className={cn(
                'hidden min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-muted hover:text-bone md:inline-flex',
                activePath(pathname, '/now') && 'bg-surface-3 text-bone shadow-soft-1',
              )}
            >
              Now
            </Link>
            <ProfileSwitcher className="hidden sm:block" />
            <Link
              href={PROFILE_HREF}
              aria-current={profileCurrent ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-muted hover:text-bone',
                profileCurrent && 'bg-surface-3 text-bone shadow-soft-1',
              )}
            >
              Profile
            </Link>
          </div>
        </div>
      </header>
      <ResumeTrip />
      {/* Outside the glass header: its backdrop-filter would trap the fixed sheet and invitation strip. */}
      {isDemoMode() && <SocialRoot />}

      {showOnboarding && (
        <div className="px-3 pt-3 sm:px-5">
          <div className="surface mx-auto flex max-w-[1600px] items-center justify-between gap-3 rounded-[var(--radius-control)] py-2 pl-4 pr-2 text-[13px] text-ink-soft">
            <span>Set your traveler lens. It takes under a minute.</span>
            <span className="flex shrink-0 items-center gap-1">
              <Link href={`/welcome?from=${encodeURIComponent(pathname)}`} className="btn btn-ghost btn-sm">
                Begin
              </Link>
              <button type="button" onClick={skip} className="min-h-11 rounded-full px-3 text-ink-muted hover:text-bone" aria-label="Skip the traveler lens for now">
                Skip
              </button>
            </span>
          </div>
        </div>
      )}

      <div
        id="main"
        className={cn(
          'pb-20 md:pb-0',
          !world && 'mx-auto max-w-[1600px]',
        )}
      >
        {children}
      </div>

      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-surface-0 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activePath(pathname, item.href) ? 'page' : undefined}
                className={cn(
                  'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-subtle',
                  activePath(pathname, item.href) && 'text-saffron',
                )}
              >
                {activePath(pathname, item.href) ? <span className="horizon-band absolute inset-x-5 top-0" aria-hidden /> : null}
                <TabGlyph name={item.icon} />
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={cn(
                'relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-subtle',
                (moreOpen || moreHref) && 'text-saffron',
              )}
              aria-current={moreHref ? 'page' : undefined}
              aria-expanded={moreOpen}
              aria-controls={morePanelId}
              aria-haspopup="menu"
              aria-label="More"
              onClick={() => setMoreOpen((open) => !open)}
            >
              {moreHref ? <span className="horizon-band absolute inset-x-5 top-0" aria-hidden /> : null}
              <TabGlyph name="more" />
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
            className="fixed inset-x-0 bottom-16 top-0 z-[45] bg-void/60 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id={morePanelId}
            role="menu"
            className="surface-raised fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 px-2 py-2 md:hidden"
          >
            {MORE_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={cn(
                  'flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 text-ink-soft hover:bg-surface-4',
                  moreHref === item.href && 'bg-surface-1 text-saffron shadow-[var(--shadow-inset)]',
                )}
              >
                <span className="text-[15px] font-medium">{item.label}{moreHref === item.href ? <span className="sr-only"> (current page)</span> : null}</span>
                <span className="text-[12px] text-ink-subtle">{item.hint}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      <CommandPalette />
      <SunModal />
    </div>
  );
}
