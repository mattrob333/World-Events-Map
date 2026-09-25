'use client';

import { NavLink } from './NavLink';
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
import { SunButton, SunGlyph, SunModal } from '@/components/voice/SunModal';
import { useDesignerStore } from '@/lib/designer/store';
import { useVoiceStore } from '@/lib/voice/registry';
import { ProfileSwitcher } from './ProfileSwitcher';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
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
  const skipped = useOnboardingStore((s) => s.skipped);
  const hasProfile = useDesignerStore((s) => s.profiles.length > 0);
  const setVibeOpen = useVoiceStore((s) => s.setOpen);
  // The vibe is the way in: prompt until there's a profile, unless they said not now.
  const showVibePrompt = mounted && world && !hasProfile && !skipped;
  const moreHref = currentMoreHref(pathname);
  const profileCurrent = activePath(pathname, PROFILE_HREF);
  const auth = usePlatformAuth();
  // "Log in" only where membership is connected and nobody is signed in yet.
  const showLogin = mounted && Boolean(auth.client) && !auth.loading && !auth.user;

  // The login screen is its own full-screen moment: no header, tab bar or prompts.
  if (pathname === '/login') return <div className="min-h-dvh bg-void text-ink">{children}</div>;

  return (
    <div className={cn('min-h-dvh bg-void text-ink', world && 'bg-transparent')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:bg-void focus:px-3 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      {/* Opaque: at 90% the page text showed through while scrolling (UFR2-J11). */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-surface-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-5">
          <NavLink href="/" className="flex min-h-11 shrink-0 items-center" aria-label="dope.travel home">
            {/* One drawn lockup, so ".travel" always shares the wordmark's baseline. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand SVG */}
            <img src="/brand/dope-travel-lockup.svg" alt="" width={95} height={32} className="h-8 w-auto" />
          </NavLink>
          {isDemoMode() && (
            <span
              className="tag shrink-0 text-saffron"
              title={DEMO_LABEL}
            >
              Demo<span className="hidden sm:inline"> · simulated</span>
            </span>
          )}
          <nav aria-label="Primary" className="hidden items-center gap-1 rounded-full bg-surface-1 p-1 shadow-[var(--shadow-inset)] lg:flex">
            {PRIMARY.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium leading-none text-ink-muted transition-colors hover:text-bone',
                  activePath(pathname, item.href) && 'bg-surface-3 text-bone shadow-soft-1',
                )}
                aria-current={activePath(pathname, item.href) ? 'page' : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <SunButton />
            <SearchTrigger />
            {/* Demo only: the member plate mounts the profile sheet, invitations and share links. */}
            {isDemoMode() && <CurrentMemberChip className="hidden lg:flex" mountRoot={false} />}
            {/* lg and up: below that, Now lives in More so one route never lights twice. */}
            <NavLink
              href="/now"
              aria-current={activePath(pathname, '/now') ? 'page' : undefined}
              className={cn(
                'hidden min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-muted hover:text-bone lg:inline-flex',
                activePath(pathname, '/now') && 'bg-surface-3 text-bone shadow-soft-1',
              )}
            >
              Now
            </NavLink>
            <ProfileSwitcher className="hidden lg:block" />
            <NavLink
              href={PROFILE_HREF}
              aria-current={profileCurrent ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-muted hover:text-bone',
                profileCurrent && 'bg-surface-3 text-bone shadow-soft-1',
              )}
            >
              Profile
            </NavLink>
            {showLogin && (
              <NavLink
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="hidden min-h-11 items-center rounded-full bg-surface-2 px-3.5 text-[13px] font-semibold text-bone shadow-soft-1 hover:bg-surface-3 sm:inline-flex"
              >
                Log in
              </NavLink>
            )}
          </div>
        </div>
      </header>
      <ResumeTrip />
      {/* Outside the glass header: its backdrop-filter would trap the fixed sheet and invitation strip. */}
      {isDemoMode() && <SocialRoot />}

      {showVibePrompt && (
        // A floating card, not an in-flow bar: it mounts after hydration and used to push the page down (CLS).
        // Bottom-right on desktop: bottom-left is where the hero's own call to action sits.
        <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[44] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[26rem]">
          {/* Slim on phones (one line), the fuller card on larger screens. */}
          <div className="vibe-prompt mx-auto flex max-w-[1600px] items-center gap-3 rounded-full py-1.5 pl-2 pr-1.5 sm:rounded-[20px] sm:py-3 sm:pl-3 sm:pr-2">
            <span className="sm:hidden"><SunGlyph size={30} glow /></span>
            <span className="hidden sm:inline-flex"><SunGlyph size={40} glow /></span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[15px] font-semibold leading-tight text-bone">Set your vibe</strong>
              <span className="hidden text-[12.5px] leading-snug text-ink-soft sm:block">Tell us how you get down. Two minutes, talk or type.</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={() => setVibeOpen(true)} className="btn btn-primary btn-sm">
                Let&apos;s go
              </button>
              <button type="button" onClick={skip} className="min-h-11 rounded-full px-2.5 text-[12px] text-ink-muted hover:text-bone" aria-label="Not now: hide the vibe prompt">
                Not now
              </button>
            </span>
          </div>
        </div>
      )}

      <div
        id="main"
        className={cn(
          // Room for the tab bar, and for the floating prompt while it shows, so a page's last lines aren't stuck under them.
          showVibePrompt ? 'pb-[calc(9rem+env(safe-area-inset-bottom))] lg:pb-28' : 'pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0',
          !world && 'mx-auto max-w-[1600px]',
        )}
      >
        {children}
      </div>

      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-surface-0 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE.map((item) => (
            <li key={item.href}>
              <NavLink
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
              </NavLink>
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
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-0 z-[45] bg-void/60 lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id={morePanelId}
            role="menu"
            className="surface-raised fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 px-2 py-2 lg:hidden"
          >
            {showLogin && (
              <NavLink
                href={`/login?next=${encodeURIComponent(pathname)}`}
                role="menuitem"
                className="flex min-h-12 items-center justify-between gap-3 rounded-[var(--radius-control)] px-3 text-bone hover:bg-surface-4"
              >
                <span className="text-[15px] font-semibold">Log in</span>
                <span className="text-[12px] text-ink-subtle">Email link, no password</span>
              </NavLink>
            )}
            {MORE_ITEMS.map((item) => (
              <NavLink
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
              </NavLink>
            ))}
          </div>
        </>
      )}
      <CommandPalette />
      <SunModal />
    </div>
  );
}
