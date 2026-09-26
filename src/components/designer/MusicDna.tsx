import type { ListeningProfile } from '@/lib/designer/listening';
import { musicDna, musicSignals } from '@/lib/vibe/musicDna';
import { VOCAB } from '@/lib/vibe/signals';

const label = (key: string) => VOCAB.find((entry) => entry.key === key)?.label;

/**
 * What their listening says, made usable: the share of each music family,
 * and the scene tags that come from it. The tags are what the concierge
 * matches venues and nights against.
 */
export function MusicDna({ listening }: { listening: ListeningProfile }) {
  const dna = musicDna(listening).slice(0, 6);
  const tags = musicSignals(listening, label);
  if (!dna.length) return null;
  return (
    <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-saffron">Your music DNA</p>
        <ul className="mt-2 grid gap-2">
          {dna.map((row) => (
            <li key={row.key} className="grid grid-cols-[1.5rem_8.5rem_1fr_2.5rem] items-center gap-2 text-[13px]" title={row.genres.join(', ')}>
              <span aria-hidden="true">{row.emoji}</span>
              <span className="truncate text-bone">{row.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                <i className="block h-full rounded-full bg-gradient-to-r from-saffron via-tangerine to-flamingo" style={{ width: `${Math.round(row.share * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink-soft">{Math.round(row.share * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
      {tags.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-saffron">Scenes it points to</p>
          <p className="mt-1 text-[12px] text-ink-muted">Tags the concierge matches places and nights against. Starred ones weigh most.</p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Scene tags from your music">
            {tags.map((tag) => (
              <li key={tag.key} title={tag.note} className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium ${tag.strength === 'love' ? 'bg-saffron/15 text-saffron' : 'bg-white/[0.06] text-ink-soft'}`}>
                {tag.strength === 'love' ? '★ ' : ''}{tag.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
