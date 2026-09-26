'use client';

import { NavLink } from './NavLink';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/components/ui';
import { useOnboardingStore } from '@/lib/onboarding';
import { DEMO_LABEL, FEATURES, isDemoMode } from '@/lib/flags';
import dynamic from 'next/dynamic';

// Demo-only social layer: loaded on demand so non-demo builds don't ship it.
const CurrentMemberChip = dynamic(() => import('@/components/social/CurrentMemberChip').then((m) => m.CurrentMemberChip), { ssr: false });
const SocialRoot = dynamic(() => import('@/components/social/MemberProfileSheet').then((m) => m.SocialRoot), { ssr: false });
import { CommandPalette, SearchTrigger } from './CommandPalette';
import { ProfileSync } from './ProfileSync';
import { SunButton, SunGlyph, SunModal } from '@/components/voice/SunModal';
import { useDesignerStore } from '@/lib/designer/store';
import { useVoiceStore } from '@/lib/voice/registry';
import { ProfileSwitcher } from './ProfileSwitcher';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import { ResumeTrip } from './ResumeTrip';
import { AccountMenu } from './AccountMenu';

/**
 * One North Star: show where the energy is, at any zoom, and help me get into
 * it. Five places: Pulse (what's hot, from the globe down), Trips, Now (the
 * sun: what's hot near me), You (your travelers), More.
 */
const PRIMARY = [
  { href: '/', label: 'Pulse' },
  { href: '/trips', label: 'Trips' },
  { href: '/now', label: 'Now' },
  { href: '/vibe', label: 'You' },
] as const;

// Two tabs either side of the sun (Now) in the middle.
const MOBILE_LEFT = [
  { href: '/', label: 'Pulse', icon: 'pulse' },
  { href: '/trips', label: 'Trips', icon: 'trips' },
] as const;
const MOBILE_RIGHT = [{ href: '/vibe', label: 'You', icon: 'you' }] as const;

type TabIcon = (typeof MOBILE_LEFT)[number]['icon'] | (typeof MOBILE_RIGHT)[number]['icon'] | 'more';

/** Line icons for the phone tab bar: 22px, 1.6 stroke, currentColor. */
function TabGlyph({ name }: { name: TabIcon }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'pulse':
      return (<svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" /></svg>);
    case 'trips':
      return (<svg {...common}><rect x="4" y="7.5" width="16" height="12" rx="2.5" /><path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5M4 12.5h16" /></svg>);
    case 'you':
      return (<svg {...common}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" /></svg>);
    default:
      return (<svg {...common}><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></svg>);
  }
}

// More: settings, and shelved features only when their flag is on.
const MORE_LINKS = [
  { href: '/settings', label: 'Settings', hint: 'Account, privacy, your data', on: true },
  { href: '/access', label: 'Access', hint: 'Charter and partner offers', on: FEATURES.access },
  { href: '/circles', label: 'Circles', hint: 'Travel with members', on: FEATURES.circles },
].filter((item) => item.on);

// Mirrors getPlatformClient(): member services exist only with both public keys.
const MEMBERSHIP_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// One profile: the traveler profile. The member account (sign-in, privacy, data) is "Settings" in More.
const PROFILE_HREF = '/vibe';
const PRIMARY_HREFS: readonly string[] = PRIMARY.map((item) => item.href);
const MORE_ITEMS = MORE_LINKS.filter((item) => MEMBERSHIP_CONFIGURED || item.href !== '/settings');

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
    .filter((item) => item.href !== profileHref && !PRIMARY_HREFS.includes(item.href) && activePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.href ?? null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [mounted, setMounted] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [sunOpen, setSunOpen] = useState(false);
  const morePanelId = useId();
  const sunPanelId = useId();
  const skip = useOnboardingStore((s) => s.skip);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    setMoreOpen(false);
    setSunOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!moreOpen && !sunOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMoreOpen(false);
      setSunOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen, sunOpen]);

  const world = pathname === '/';
  // The lens invitation belongs to the front door only: on every page it pushed
  // content down, and on /vibe it competed with the board's own flow (UFR2-J13).
  const skipped = useOnboardingStore((s) => s.skipped);
  const hasProfile = useDesignerStore((s) => s.profiles.length > 0);
  const setVibeOpen = useVoiceStore((s) => s.setOpen);
  // The vibe is the way in: prompt until there's a profile, unless they said not now.
  const showVibePrompt = mounted && world && !hasProfile && !skipped;
  const moreHref = currentMoreHref(pathname);
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
            {/* On phones the sun lives in the middle of the tab bar instead. */}
            <span className="hidden lg:contents"><SunButton /></span>
            <SearchTrigger />
            {/* Demo only: the member plate mounts the profile sheet, invitations and share links. */}
            {isDemoMode() && <CurrentMemberChip className="hidden lg:flex" mountRoot={false} />}
            {/* Desktop More: the same menu as the phone's, as a dropdown. */}
            <button
              type="button"
              className={cn('hidden min-h-11 items-center rounded-full px-3.5 text-[13px] font-medium text-ink-muted hover:text-bone lg:inline-flex', (moreOpen || moreHref) && 'text-bone')}
              aria-expanded={moreOpen}
              aria-controls={morePanelId}
              aria-haspopup="menu"
              onClick={() => {
                setSunOpen(false);
                setMoreOpen((open) => !open);
              }}
            >
              More
            </button>
            <ProfileSwitcher className="hidden lg:block" />
            {/* Signed in: their avatar and a menu. Signed out: Log in. */}
            <AccountMenu />
          </div>
        </div>
      </header>
      <ResumeTrip />
      {/* Outside the glass header: its backdrop-filter would trap the fixed sheet and invitation strip. */}
      {isDemoMode() && <SocialRoot />}

      {showVibePrompt && !sunOpen && !moreOpen && (
        // A floating card, not an in-flow bar: it mounts after hydration and used to push the page down (CLS).
        // Bottom-right on desktop: bottom-left is where the hero's own call to action sits. On phones it sits above the raised sun.
        <div className="fixed inset-x-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-[44] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[26rem]">
          {/* Slim on phones (one line), the fuller card on larger screens. */}
          <div className="vibe-prompt mx-auto flex max-w-[1600px] items-center gap-3 rounded-full py-1.5 pl-2 pr-1.5 sm:rounded-[20px] sm:py-3 sm:pl-3 sm:pr-2">
            <span className="sm:hidden"><SunGlyph size={30} glow /></span>
            <span className="hidden sm:inline-flex"><SunGlyph size={40} glow /></span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-[15px] font-semibold leading-tight text-bone"><span className="sm:hidden">Set your vibe</span><span className="hidden sm:inline">Start here: set your vibe</span></strong>
              <span className="hidden text-[12.5px] leading-snug text-ink-soft sm:block">Two minutes of talking tunes every trip to you. Make one for you, the family, or work trips.</span>
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
          {MOBILE_LEFT.map((item) => (
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
          <li className="relative flex justify-center">
            {/* The sun: round, raised above the bar, the way in to vibing or planning. */}
            <button
              type="button"
              className="absolute -top-5 grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full bg-surface-0 shadow-[0_6px_24px_rgb(242_107_42/0.35)] ring-1 ring-white/[0.08] transition-transform active:scale-95"
              aria-label="Now: what’s busy near you, or talk it through"
              aria-expanded={sunOpen}
              aria-controls={sunPanelId}
              aria-haspopup="menu"
              onClick={() => {
                setMoreOpen(false);
                setSunOpen((open) => !open);
              }}
            >
              <SunGlyph size={56} glow />
            </button>
          </li>
          {MOBILE_RIGHT.map((item) => (
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
              onClick={() => {
                setSunOpen(false);
                setMoreOpen((open) => !open);
              }}
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
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-0 z-[45] bg-void/60 lg:bottom-0 lg:bg-transparent"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id={morePanelId}
            role="menu"
            className="surface-raised fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 px-2 py-2 lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-16 lg:w-80"
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
      {sunOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] top-0 z-[45] bg-void/60 lg:hidden"
            onClick={() => setSunOpen(false)}
          />
          <div
            id={sunPanelId}
            role="menu"
            aria-label="Now"
            className="surface-raised fixed inset-x-6 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto grid max-w-sm grid-cols-2 gap-2 p-2 lg:hidden"
          >
            <NavLink
              href="/now"
              role="menuitem"
              className="flex min-h-24 flex-col items-start justify-end gap-1 rounded-[var(--radius-control)] bg-surface-2 p-3 text-left hover:bg-surface-3"
            >
              <SunGlyph size={26} />
              <span className="text-[15px] font-semibold text-bone">Vibe Now</span>
              <span className="text-[12px] text-ink-subtle">What’s busy near you, and till when</span>
            </NavLink>
            {/* The talking concierge: your traveler profile, tonight or a trip, by voice. */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setSunOpen(false);
                setVibeOpen(true);
              }}
              className="flex min-h-24 flex-col items-start justify-end gap-1 rounded-[var(--radius-control)] bg-surface-2 p-3 text-left hover:bg-surface-3"
            >
              <span aria-hidden className="text-[22px] leading-none text-saffron">✦</span>
              <span className="text-[15px] font-semibold text-bone">Talk it through</span>
              <span className="text-[12px] text-ink-subtle">Profile, tonight or a trip, by voice</span>
            </button>
          </div>
        </>
      )}
      <CommandPalette />
      <SunModal />
      <ProfileSync />
    </div>
  );
}
