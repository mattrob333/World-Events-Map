'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { WorldEvent } from '@/lib/types';
import type { PlacePhoto } from '@/lib/place-media/media';

type GalleryResponse = { photos?: PlacePhoto[] };

export function PlaceGallery({ event, compact = false }: { event: WorldEvent; compact?: boolean }) {
  const [result, setResult] = useState<{ eventId: string; photos: PlacePhoto[] } | null>(null);
  const [active, setActive] = useState<{ eventId: string; index: number } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/place-media?eventId=${encodeURIComponent(event.id)}`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<GalleryResponse> : { photos: [] })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ eventId: event.id, photos: Array.isArray(data.photos) ? data.photos : [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ eventId: event.id, photos: [] });
      });
    return () => controller.abort();
  }, [event.id]);

  const ready = result?.eventId === event.id;
  const photos = ready ? result.photos : [];
  const visibleIndex = Math.min(active?.eventId === event.id ? active.index : 0, Math.max(0, photos.length - 1));

  function move(direction: number) {
    const node = track.current;
    if (!node) return;
    const next = Math.max(0, Math.min(photos.length - 1, visibleIndex + direction));
    node.scrollTo({ left: next * node.clientWidth, behavior: reducedMotion ? 'auto' : 'smooth' });
    setActive({ eventId: event.id, index: next });
  }

  if (!ready) {
    return <div className={`animate-pulse motion-reduce:animate-none rounded-xl border border-white/10 bg-slate-deep/70 ${compact ? 'h-44' : 'h-56'}`} aria-label="Loading Wikimedia photos" />;
  }
  if (!photos.length) {
    return (
      <div className={`flex items-end rounded-xl border border-white/10 bg-gradient-to-br from-slate-deep via-obsidian to-void p-4 ${compact ? 'min-h-44' : 'min-h-44'}`}>
        <p className="text-[11px] leading-5 text-ink-muted">Public imagery is unavailable for {event.city} right now. Explore the curated occasion below.</p>
      </div>
    );
  }

  return (
    <section className="min-w-0" aria-label={`Public archive photos for ${event.city}`}>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-obsidian">
        <div
          key={event.id}
          ref={track}
          onScroll={(e) => setActive({ eventId: event.id, index: Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)) })}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth motion-reduce:scroll-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo) => <PhotoSlide key={photo.sourceUrl} photo={photo} city={event.city} compact={compact} />)}
        </div>
        {photos.length > 1 && (
          <div className="absolute right-2 top-2 z-10 flex gap-1">
            <button type="button" onClick={() => move(-1)} disabled={visibleIndex === 0} aria-label="Previous photo" className="flex size-7 items-center justify-center rounded-full border border-white/20 bg-void/75 text-ink backdrop-blur disabled:opacity-35">‹</button>
            <button type="button" onClick={() => move(1)} disabled={visibleIndex === photos.length - 1} aria-label="Next photo" className="flex size-7 items-center justify-center rounded-full border border-white/20 bg-void/75 text-ink backdrop-blur disabled:opacity-35">›</button>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-ink-faint">Wikimedia Commons archive · {visibleIndex + 1} / {photos.length} · Images may be from earlier years</p>
    </section>
  );
}

function PhotoSlide({ photo, city, compact }: { photo: PlacePhoto; city: string; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="relative min-w-full snap-start">
      {failed ? (
        <div className={`flex items-center justify-center bg-slate-deep px-4 text-center text-[11px] text-ink-muted ${compact ? 'h-44' : 'h-56'}`}>This public image could not be loaded.</div>
      ) : (
        // Wikimedia URLs are checked by the server and vary per file; Next image optimization is intentionally bypassed.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.imageUrl} alt={photo.subject === 'event' ? photo.title : `${city} place photograph: ${photo.title}`} onError={() => setFailed(true)} loading="lazy" className={`w-full object-cover ${compact ? 'h-44' : 'h-56'}`} />
      )}
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/85 to-transparent px-3 pb-2 pt-8 text-[10px] leading-4 text-ink">
        <span className={`mb-1 inline-block rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] ${photo.subject === 'event' ? 'border-signal/40 bg-signal/15 text-signal' : 'border-brass/40 bg-brass/15 text-brass'}`}>{photo.subject === 'event' ? 'Event archive' : 'Place imagery'}</span>
        <span className="block truncate">{photo.title}</span>
        <span className="block truncate text-ink-muted">{photo.photographed ? `Photographed ${photo.photographed}` : 'Photo date not supplied'} · {photo.credit} · {photo.license}</span>
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-brass underline-offset-2 hover:underline">Photo and license ↗</a>
      </figcaption>
    </figure>
  );
}
