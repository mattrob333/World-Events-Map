'use client';

import { profileLabel, useDesignerStore, type SavedProfile } from '@/lib/designer/store';

function subtitle(entry: SavedProfile): string {
  const p = entry.profile;
  const crew = p.family.length ? `with ${p.family.map((member) => member.name ?? member.label).slice(0, 3).join(', ')}` : '';
  const loves = [...(p.artists ?? []), ...p.food, ...p.interests].slice(0, 3).join(', ');
  return [p.hometown, crew, loves].filter(Boolean).join(' · ') || p.summary || 'Saved on this device';
}

/**
 * Every Vibe profile on this device: the family one, the solo one, the
 * work-trip one. Pick which plans with you, update one by talking, or start
 * another.
 */
export function ProfileManager({ onNew, onEdit }: { onNew: () => void; onEdit: (id: string) => void }) {
  const profiles = useDesignerStore((s) => s.profiles);
  const activeProfileId = useDesignerStore((s) => s.activeProfileId);
  const setActiveProfile = useDesignerStore((s) => s.setActiveProfile);
  const activeId = activeProfileId ?? profiles[0]?.id;
  return (
    <div className="mt-5 grid gap-2.5 sm:grid-cols-2" role="list" aria-label="Your Vibe profiles">
      {profiles.map((entry) => {
        const active = entry.id === activeId;
        return (
          <div key={entry.id} role="listitem" className={`flex flex-col rounded-2xl p-4 shadow-soft-1 transition-colors ${active ? 'bg-saffron/[0.08] ring-1 ring-saffron/50' : 'bg-surface-1/90'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display text-[22px] leading-tight text-bone">{profileLabel(entry)}</p>
                {entry.profile.name && <p className="text-[12.5px] text-ink-muted">{entry.profile.name}</p>}
              </div>
              {active && <span className="shrink-0 rounded-full bg-saffron/15 px-2.5 py-1 text-[11px] font-semibold text-saffron">Planning with this</span>}
            </div>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink-soft">{subtitle(entry)}</p>
            <div className="mt-auto flex gap-2 pt-3">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onEdit(entry.id)}>Edit by talking</button>
              {!active && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveProfile(entry.id)}>Plan with this</button>}
            </div>
          </div>
        );
      })}
      <div role="listitem" className="flex">
        <button
          type="button"
          onClick={onNew}
          className="flex min-h-[140px] w-full flex-col items-start justify-center gap-1 rounded-2xl border border-dashed border-white/15 p-4 text-left hover:border-saffron/50 hover:bg-white/[0.02]"
        >
          <span className="font-display text-[22px] leading-tight text-bone">+ New profile</span>
          <span className="text-[13px] text-ink-soft">Family trips, solo, work travel, the crew: one for each way you travel.</span>
        </button>
      </div>
    </div>
  );
}
