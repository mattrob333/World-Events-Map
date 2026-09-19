'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui';
import { useOnboardingStore } from '@/lib/onboarding';
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

function activePath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [mounted, setMounted] = useState(false);
  const completed = useOnboardingStore((s) => s.completed);
  const skip = useOnboardingStore((s) => s.skip);

  useEffect(() => setMounted(true), []);

  const world = pathname === '/';
  const welcome = pathname.startsWith('/welcome');
  const showOnboarding = mounted && !completed && !welcome;

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
          <Link
            href="/"
            className="font-display shrink-0 text-[15px] tracking-[0.38em] text-ink"
          >
            MERIDIAN
          </Link>
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

      {showOnboarding && (
        <div className="border-b border-brass/20 bg-brass-wash px-4 py-2 text-[12px] text-brass-bright">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
            <span>Set your traveler lens — it takes under a minute, and you can skip.</span>
            <span className="flex gap-3">
              <Link href="/welcome" className="underline decoration-brass/40 underline-offset-4">
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
            <Link
              href="/trips"
              className={cn(
                'flex h-14 items-center justify-center label-sm text-ink-muted',
                pathname.startsWith('/trips') && 'text-brass',
              )}
            >
              More
            </Link>
          </li>
        </ul>
      </nav>
      <CommandPalette />
    </div>
  );
}
