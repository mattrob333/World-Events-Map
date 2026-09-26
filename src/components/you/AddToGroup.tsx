'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useHydrated } from '@/components/designer/useHydrated';
import { pickActiveGroup, useDesignerStore } from '@/lib/designer/store';
import type { TravelCard } from '@/lib/people/card';

/**
 * Where cards from a link go: a new group that is your family plus them
 * (the usual "we're going with the Smiths"), or a group you already have.
 * Nothing is saved until they choose.
 */
export function AddToGroup({ cards, theirName }: { cards: TravelCard[]; theirName: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const groups = useDesignerStore((state) => state.groups);
  const activeGroupId = useDesignerStore((state) => state.activeGroupId);
  const addGroup = useDesignerStore((state) => state.addGroup);
  const addGuests = useDesignerStore((state) => state.addGuests);
  const setActiveGroup = useDesignerStore((state) => state.setActiveGroup);
  const targets = groups.filter((group) => group.kind !== 'solo');
  const active = pickActiveGroup(targets, activeGroupId);
  const [target, setTarget] = useState<string>('new');
  if (!hydrated) return null;
  const family = groups.find((group) => group.kind === 'family');

  function add() {
    let id = target;
    if (target === 'new') {
      const name = `${family?.memberIds.length ? 'Us' : 'Me'} + ${theirName}`.slice(0, 30);
      id = addGroup(name, 'custom', family?.memberIds ?? []);
    }
    addGuests(id, cards);
    setActiveGroup(id);
    router.push('/vibe#groups-title');
  }

  return (
    <div className="mt-6 grid max-w-xl gap-3">
      <label className="grid gap-1.5 text-[13px] text-ink-muted">
        Add them to
        <select className="min-h-11 rounded-[14px] bg-surface-1 px-3 text-[15px] text-bone shadow-[var(--shadow-inset)]" value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="new">A new group: your family and {theirName}</option>
          {targets.map((group) => (
            <option key={group.id} value={group.id}>{group.name}{group.id === active?.id ? ' (planning for now)' : ''}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={add}>Add {cards.length === 1 ? cards[0].name : `all ${cards.length}`}</button>
      </div>
      <p className="text-[12px] leading-relaxed text-ink-subtle">Saved on this device (and to your account if you turned that on). The link carried their cards; dope.travel didn’t store them.</p>
    </div>
  );
}
