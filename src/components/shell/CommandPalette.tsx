'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn, withAppKeyGuard } from '@/components/ui';
import { SEARCH_GROUP_LABEL, SEARCH_GROUPS, buildSearchCatalog, searchCatalog, type SearchGroup, type SearchHit } from '@/lib/search';
import { useIntentStore } from '@/lib/intent';
import { track } from '@/lib/analytics';
import { planTripOffer } from '@/lib/search/planPlace';
import { useCommandStore } from './commandStore';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function CommandPalette() {
  const open = useCommandStore((s) => s.open);
  const setOpen = useCommandStore((s) => s.setOpen);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const saved = useIntentStore((s) => s.items);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const metaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
      if (metaK) {
        event.preventDefault();
        setOpen(!useCommandStore.getState().open);
        return;
      }
      if (slash && !isTypingTarget(event.target) && !useCommandStore.getState().open) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape' && useCommandStore.getState().open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    // Closing clears the text; opening starts from the seed (empty unless a
    // page handed its own search over, e.g. the home search box).
    setQuery(open ? useCommandStore.getState().seed : '');
    if (!open) return;
    track('search_opened');
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  const platformConnected = Boolean(usePlatformAuth().client);
  const catalog = useMemo(() => {
    // Once partner offers are connected, sample ACCESS hits would mix fake and live.
    const base = buildSearchCatalog().filter((hit) => !(platformConnected && hit.group === 'access' && hit.href.startsWith('/access?offer=')));
    const savedHits: SearchHit[] = saved.map((item) => ({
      id: `intent-${item.verb}-${item.kind}-${item.id}`,
      group: 'saved' as const,
      title: item.label,
      subtitle: item.verb === 'idGo' ? "I'd go" : item.verb,
      href: item.href,
      keywords: `${item.label} ${item.verb}`.toLowerCase(),
    }));
    return [...savedHits, ...base];
  }, [saved, platformConnected]);

  const hits = searchCatalog(query, catalog);
  const grouped = SEARCH_GROUPS.map((group) => ({
    group,
    hits: hits.filter((hit) => hit.group === group),
  })).filter((entry) => entry.hits.length > 0);
  // A place the calendar doesn't cover can still become a trip (owner: "make it searchable").
  const planOffer = planTripOffer(query, hits);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-void/70 px-3 pt-[12vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (Date.now() - useCommandStore.getState().openedAt < 400) return;
        setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search dope.travel"
        className="surface-raised w-full max-w-xl overflow-hidden"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <label className="flex items-center gap-3 border-b border-ink/10 px-4 py-3">
          <span className="label-sm text-ink-muted">Search</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={withAppKeyGuard()}
            placeholder="Destinations, events, people, circles, access"
            className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted"
            aria-label="Search destinations, events, people, circles and access"
          />
          <kbd className="label-sm hidden text-ink-faint sm:inline">ESC</kbd>
        </label>
        <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
          {planOffer && (
            <section className="mb-2">
              <h2 className="label-sm px-3 py-2 text-ink-muted">Not on the calendar yet</h2>
              <Link
                href={planOffer.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 flex-col justify-center rounded-[var(--radius-control)] px-3 py-2 hover:bg-surface-4"
              >
                <span className="block text-[14px] font-medium text-bone">Plan a trip to “{planOffer.label}” <span aria-hidden="true">→</span></span>
                <span className="block text-[12px] text-ink-muted">Opens the trip designer on this device. Nothing is booked or searched until you ask.</span>
              </Link>
            </section>
          )}
          {grouped.length === 0 && !planOffer ? (
            <p className="px-3 py-8 text-[13px] text-ink-muted">
              Nothing matches. Try a city, a person, or an occasion.
            </p>
          ) : (
            grouped.map((entry) => (
              <section key={entry.group} className="mb-2">
                <h2 className="label-sm px-3 py-2 text-ink-muted">
                  {SEARCH_GROUP_LABEL[entry.group as SearchGroup]}
                </h2>
                <ul>
                  {entry.hits.slice(0, 6).map((hit) => (
                    <li key={hit.id}>
                      <Link
                        href={hit.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-[var(--radius-control)] px-3 py-2 hover:bg-surface-4"
                      >
                        <span className="block text-[13px] text-ink">{hit.title}</span>
                        <span className="block text-[11px] text-ink-muted">{hit.subtitle}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2">
          <p className="text-[11px] text-ink-subtle">
            Local catalog plus editorial fixtures. Not a live member index.
          </p>
          <Button size="sm" variant="quiet" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SearchTrigger({ className }: { className?: string }) {
  const setOpen = useCommandStore((s) => s.setOpen);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setOpen(true);
      }}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full bg-surface-1 px-3 text-[13px] text-ink-muted shadow-[var(--shadow-inset)] hover:text-bone sm:justify-start sm:px-4',
        className,
      )}
      aria-label="Open search"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded-md bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle lg:inline">⌘K</kbd>
    </button>
  );
}
