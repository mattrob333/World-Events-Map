'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getPlatformClient } from '@/lib/platform/client';
import type { PartnerOffer } from '@/lib/platform/types';
import type { ScenePost } from '@/lib/data/social-feed';

export function LivePulse({
  eventId,
  planning = false,
}: {
  eventId?: string;
  planning?: boolean;
}) {
  const [offers, setOffers] = useState<PartnerOffer[]>([]);
  const [posts, setPosts] = useState<ScenePost[]>([]);
  const [checked, setChecked] = useState<string | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const client = getPlatformClient();
    const refresh = async () => {
      if (document.hidden) return;
      try {
        if (client) {
          let query = client
            .from('offers')
            .select('*,provider_orgs!inner(name,status)')
            .eq('provider_orgs.status', 'approved')
            .eq('status', 'published')
            .gt('expires_at', new Date().toISOString())
            .order('updated_at', { ascending: false })
            .limit(3);
          if (planning && eventId) query = query.eq('event_id', eventId);
          const result = await query;
          if (result.error) throw result.error;
          if (active) {
            setOffers(result.data ?? []);
            setChecked(new Date().toISOString());
          }
        }
        if (eventId && !planning) {
          const response = await fetch(
            `/api/scene-posts?event=${encodeURIComponent(eventId)}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error('Feed unavailable');
          const data = await response.json();
          if (active) setPosts(data.posts ?? []);
        } else if (active) setPosts([]);
        if (active) setError(false);
      } catch {
        if (active) {
          setError(true);
          setOffers([]);
          setPosts([]);
        }
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [eventId, planning]);
  return (
    <section
      className="border-t border-white/10 pt-5 mt-5"
      aria-label="Fresh opportunities"
    >
      <p className="text-[10px] tracking-[.16em] uppercase text-brass-bright">
        {planning ? 'Access for your trip' : 'Just released'}
      </p>
      {offers.map((offer) => (
        <Link
          key={offer.id}
          href={`/community?tab=offers${offer.event_id ? `&event=${encodeURIComponent(offer.event_id)}` : ''}`}
          className="block border-b border-white/10 py-4"
        >
          <span className="text-xs text-signal">
            {offer.destination} · {offer.kind}
          </span>
          <strong className="block font-display text-xl leading-snug mt-1">
            {offer.title}
          </strong>
          <span className="block text-xs text-ink-muted mt-2">
            {offer.price_label || 'Price on request'} ·{' '}
            {offer.availability === 'provider_updated'
              ? 'Provider updated'
              : 'Request only'}
          </span>
          <span className="block text-xs text-brass-bright mt-2">
            Request availability ↗
          </span>
        </Link>
      ))}
      {!offers.length && (
        <p className="text-xs leading-relaxed text-ink-muted mt-3">
          {error
            ? 'Opportunities are temporarily unavailable. Try again shortly.'
            : 'New stays, arrivals and access from verified partners will appear here.'}
        </p>
      )}
      {checked && !error && (
        <p className="text-[10px] text-ink-muted mt-3">
          Checked{' '}
          {new Date(checked).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · subject to provider confirmation
        </p>
      )}
      {posts.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] tracking-[.16em] text-brass-bright">
            FROM THE SCENE · X
          </p>
          {posts.slice(0, 2).map((post) => (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block border-b border-white/10 py-3"
            >
              <strong className="text-sm">{post.author}</strong>
              <span className="block text-xs text-ink-muted">
                @{post.handle} · {new Date(post.createdAt).toLocaleString()}
              </span>
              <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap">
                {post.text}
              </p>
              <span className="text-xs text-brass-bright">View on X ↗</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
