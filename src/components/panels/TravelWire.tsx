'use client';

import { useEffect, useState } from 'react';
import type { LiveTravelWire } from '@/lib/signals/wire';

/**
 * Read-only strip for the world dashboard. It shows provider readings the
 * server already stored. It does not start a vendor refresh.
 */
export function TravelWire() {
  const [wire, setWire] = useState<LiveTravelWire | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch('/api/travel-wire', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Travel wire unavailable');
        const body = (await response.json()) as LiveTravelWire;
        if (active) {
          setWire(body);
          setError(false);
        }
      } catch (err) {
        if (!active || (err as Error).name === 'AbortError') return;
        setError(true);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return (
    <section className="border-t border-white/10 pt-5 mt-5" aria-label="Live travel wire">
      <p className="text-[10px] tracking-[.16em] uppercase text-brass-bright">
        Live travel wire
      </p>
      {error && (
        <p className="text-xs leading-relaxed text-ink-muted mt-3">
          The travel wire is temporarily unavailable.
        </p>
      )}
      {wire && (
        <p className="text-xs leading-relaxed text-ink-muted mt-3">{wire.note}</p>
      )}
      {wire?.cards.map((card) => (
        <article key={card.id} className="border-b border-white/10 py-3">
          <p className="text-[10px] tracking-[.16em] uppercase text-brass-bright">
            {card.deltaLabel}
          </p>
          <p className="text-sm leading-snug">{card.headline}</p>
          <p className="text-xs leading-relaxed text-ink-muted mt-1">{card.detail}</p>
        </article>
      ))}
    </section>
  );
}
