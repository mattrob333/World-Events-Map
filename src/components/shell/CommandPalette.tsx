'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, cn, withAppKeyGuard } from '@/components/ui';
import { SEARCH_GROUP_LABEL, SEARCH_GROUPS, buildSearchCatalog, searchCatalog, type SearchGroup, type SearchHit } from '@/lib/search';
import { useIntentStore } from '@/lib/intent';
import { track } from '@/lib/analytics';
import { useCommandStore } from './commandStore';

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
    if (!open) {
      setQuery('');
      return;
    }
    track('search_opened');
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  const catalog = useMemo(() => {
    const base = buildSearchCatalog();
    const savedHits: SearchHit[] = saved.map((item) => ({
      id: `intent-${item.verb}-${item.kind}-${item.id}`,
      group: 'saved' as const,
      title: item.label,
      subtitle: item.verb === 'idGo' ? "I'd go" : item.verb,
      href: item.href,
      keywords: `${item.label} ${item.verb}`.toLowerCase(),
    }));
    return [...savedHits, ...base];
  }, [saved]);

  const hits = searchCatalog(query, catalog);
  const grouped = SEARCH_GROUPS.map((group) => ({
    group,
    hits: hits.filter((hit) => hit.group === group),
  })).filter((entry) => entry.hits.length > 0);

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
        aria-label="Search MERIDIAN"
        className="glass-deep w-full max-w-xl overflow-hidden rounded-[3px]"
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
          {grouped.length === 0 ? (
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
                        className="block rounded-[2px] px-3 py-2 hover:bg-ink/6"
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
          <p className="text-[10px] text-ink-faint">
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
        'inline-flex h-8 items-center gap-2 rounded-[2px] border border-ink/10 px-2.5 text-[11px] text-ink-muted hover:border-ink/25 hover:text-ink',
        className,
      )}
      aria-label="Open search"
    >
      <span aria-hidden>⌕</span>
      <span className="hidden sm:inline">Search</span>
      <kbd className="label-sm hidden text-ink-faint lg:inline">⌘K</kbd>
    </button>
  );
}
