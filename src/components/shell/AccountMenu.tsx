'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { pickActiveProfile, useDesignerStore } from '@/lib/designer/store';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

/** Two letters for the avatar: their name, else their traveler profile's name, else the email. */
export function initialsFor(name: string | undefined, email: string | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter((word) => /^[\p{L}]/u.test(word));
  if (words.length >= 2) return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
  if (words.length === 1) return words[0]![0]!.toUpperCase();
  const local = (email ?? '').split('@')[0] ?? '';
  return local ? local[0]!.toUpperCase() : '';
}

/**
 * The header's right edge, the way every site does it: signed in, their
 * avatar (initials) with a small menu; signed out, "Log in". Without member
 * services, the avatar stands for the traveler profile on this device.
 */
export function AccountMenu() {
  const hydrated = useHydrated();
  const pathname = usePathname() ?? '/';
  const auth = usePlatformAuth();
  const board = useDesignerStore((s) => pickActiveProfile(s.profiles, s.activeProfileId));
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const members = Boolean(auth.client);
  // Holds its size while the session is read, so the header doesn't jump.
  if (!hydrated || (members && auth.loading)) return <span className="inline-block size-10 shrink-0" aria-hidden="true" />;

  if (members && !auth.user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname)}`}
        className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-surface-2 px-4 text-[13px] font-semibold text-bone shadow-soft-1 hover:bg-surface-3"
      >
        Log in
      </Link>
    );
  }

  const meta = (auth.user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = (typeof meta.full_name === 'string' && meta.full_name) || (typeof meta.display_name === 'string' && meta.display_name) || board?.profile.name;
  const email = auth.user?.email ?? undefined;
  const initials = initialsFor(name || undefined, email);

  return (
    <div ref={box} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Your account${name ? `: ${name}` : ''}`}
        className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-saffron via-tangerine to-flamingo text-[14px] font-bold text-[#1a0b06] shadow-soft-1 ring-2 ring-transparent transition hover:ring-white/20 focus-visible:outline-none focus-visible:ring-bone"
      >
        {initials || (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.5" />
            <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" />
          </svg>
        )}
      </button>
      {open && (
        <div id={menuId} role="menu" className="surface-raised absolute right-0 top-12 z-50 w-64 p-2">
          <div className="px-3 pb-2 pt-1">
            <p className="truncate text-[14px] font-semibold text-bone">{name || 'Your account'}</p>
            {email ? <p className="truncate text-[12px] text-ink-subtle">{email}</p> : <p className="text-[12px] text-ink-subtle">On this device</p>}
          </div>
          <Link role="menuitem" onClick={() => setOpen(false)} href="/vibe" className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[14px] text-ink-soft hover:bg-surface-3 hover:text-bone">Traveler profile</Link>
          <Link role="menuitem" onClick={() => setOpen(false)} href="/trips" className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[14px] text-ink-soft hover:bg-surface-3 hover:text-bone">Your trips</Link>
          {members && <Link role="menuitem" onClick={() => setOpen(false)} href="/settings" className="flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-[14px] text-ink-soft hover:bg-surface-3 hover:text-bone">Settings</Link>}
          {members && auth.user && (
            <button
              role="menuitem"
              type="button"
              onClick={() => { setOpen(false); void auth.signOut(); }}
              className="mt-1 flex min-h-11 w-full items-center rounded-[var(--radius-control)] border-t border-white/[0.06] px-3 text-left text-[14px] text-ink-soft hover:bg-surface-3 hover:text-bone"
            >
              Log out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
