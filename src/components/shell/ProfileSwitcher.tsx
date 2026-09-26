'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { pickActiveGroup, useDesignerStore } from '@/lib/designer/store';
import { groupTravelers } from '@/lib/travelers/groups';

/**
 * "Traveling as": picks the group (Solo, Family, Friends, one added from a
 * link) the designer, Now and the Sun plan for. Groups live on this device,
 * and in the account when sync is on.
 */
export function ProfileSwitcher({ className = '' }: { className?: string }) {
  const hydrated = useHydrated();
  const profiles = useDesignerStore((state) => state.profiles);
  const groups = useDesignerStore((state) => state.groups);
  const activeId = useDesignerStore((state) => state.activeGroupId);
  const setActive = useDesignerStore((state) => state.setActiveGroup);
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = pickActiveGroup(groups, activeId);
  if (!hydrated || !profiles.length || !active) return null;

  return (
    <div ref={wrap} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={menuId}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-muted hover:text-bone"
      >
        <span className="text-ink-subtle">As</span>
        <span className="font-medium text-bone">{active.name}</span>
        <span aria-hidden="true" className="text-[10px]">▾</span>
      </button>
      {open && (
        <div id={menuId} className="surface absolute right-0 top-full z-50 mt-2 w-64 p-1.5">
          <p className="eyebrow px-2.5 pb-1 pt-1.5">Traveling as</p>
          <ul>
            {groups.map((entry) => {
              const on = entry.id === active.id;
              const who = groupTravelers(entry, profiles).map((traveler) => traveler.name).slice(0, 4).join(', ');
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setActive(entry.id);
                      setOpen(false);
                    }}
                    className={`flex min-h-11 w-full flex-col items-start justify-center rounded-[var(--radius-control)] px-2.5 py-1.5 text-left hover:bg-surface-3 ${on ? 'bg-surface-1 shadow-[var(--shadow-inset)]' : ''}`}
                  >
                    <span className={`text-[14px] font-medium ${on ? 'text-saffron' : 'text-bone'}`}>{entry.name}</span>
                    {who && <span className="text-[12px] text-ink-subtle">{who}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link href="/vibe" onClick={() => setOpen(false)} className="mt-1 flex min-h-11 items-center rounded-[var(--radius-control)] px-2.5 text-[13px] text-ink-soft hover:bg-surface-3">
            Travelers and groups
          </Link>
          {process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? (
            <Link href="/account" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-[var(--radius-control)] px-2.5 text-[13px] text-ink-soft hover:bg-surface-3">
              Account and sign-in
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
