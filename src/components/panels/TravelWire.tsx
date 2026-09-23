'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Chip, EmptyState, Sheet } from '@/components/ui';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import type { LiveTravelWire, WireCard } from '@/lib/signals/wire';
import { useGlobeStore } from '@/lib/stores/useGlobeStore';
import styles from './travel-wire.module.css';
import {
  WIRE_ACTIONS,
  actionHref,
  cardAsOf,
  cardBadge,
  cardEntity,
  cardMeta,
  eventHref,
  formatValuePair,
  isCardMuted,
  shouldPulseRising,
  staleConfirmLine,
  whyRows,
  wireChrome,
  type WireActionId,
  type WireChromeStatus,
} from './travelWireView';

/**
 * The Live Travel Wire on World Pulse.
 *
 * It repeats numbers GET /api/travel-wire already returned. It does not start
 * a vendor refresh, invent a crowd, or write a second headline.
 */
export function TravelWire({
  wire: supplied,
  fixture = false,
}: {
  /** Ready-made wire for fixture demos. The live page leaves this unset. */
  wire?: LiveTravelWire | null;
  /** Label this pack Fixture so it is never read as a live crowd. */
  fixture?: boolean;
} = {}) {
  const controlled = supplied !== undefined;
  const [fetched, setFetched] = useState<LiveTravelWire | null>(null);
  const [error, setError] = useState(false);
  const [whyCard, setWhyCard] = useState<WireCard | null>(null);
  const [shareNote, setShareNote] = useState<{ eventId: string; text: string } | null>(null);
  const { user } = usePlatformAuth();
  const select = useGlobeStore((s) => s.select);

  useEffect(() => {
    if (controlled) return;
    let active = true;
    let inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      if (!active || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await fetch('/api/travel-wire', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Travel wire unavailable');
        const body = (await response.json()) as LiveTravelWire;
        if (active) {
          setFetched(body);
          setError(false);
        }
      } catch (err) {
        if (!active || (err as Error).name === 'AbortError') return;
        setError(true);
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const onVisibility = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [controlled]);

  const wire = controlled ? supplied : fetched;
  const status: WireChromeStatus = error
    ? 'error'
    : wire
      ? wire.status
      : 'loading';
  const clock = new Date().toISOString();
  const chrome = wireChrome(status, wire?.note ?? null, wire?.generatedAt ?? null, clock);
  const cards = chrome.empty ? [] : (wire?.cards ?? []);

  const share = useCallback(async (eventId: string) => {
    const href = actionHref('share', eventId);
    if (!href) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(href);
        setShareNote({ eventId, text: 'Link copied' });
        return;
      }
      throw new Error('no clipboard');
    } catch {
      setShareNote({ eventId, text: href });
    }
  }, []);

  return (
    <section
      className={styles.stream}
      aria-label="Live travel wire"
      data-wire-status={status}
      data-wire-live={chrome.live ? 'true' : 'false'}
      data-wire-fixture={fixture ? 'true' : undefined}
    >
      <div className={styles.headerRow}>
        <p className="text-[10px] tracking-[.16em] uppercase text-brass-bright">
          {chrome.live && <span className={styles.liveMark} aria-hidden />}
          {chrome.title}
        </p>
        {fixture && (
          <Chip readOnly>
            Fixture
          </Chip>
        )}
      </div>

      {chrome.banner && (
        <p className={`${styles.banner} text-xs leading-relaxed text-ink-muted`}>
          {chrome.banner}
        </p>
      )}

      {chrome.useEmptyState && (
        <EmptyState
          className="px-0"
          wide
          title={chrome.emptyTitle}
          body={chrome.emptyBody}
        />
      )}

      {cards.map((card) => (
        <WireCardView
          key={card.id}
          card={card}
          status={status}
          nowIso={clock}
          fixture={fixture}
          signedIn={Boolean(user)}
          shareNote={
            shareNote && shareNote.eventId === card.eventId ? shareNote.text : null
          }
          onWhy={() => setWhyCard(card)}
          onShare={share}
        />
      ))}

      <WhySheet
        card={whyCard}
        onClose={() => setWhyCard(null)}
        onOpenEvent={(eventId) => {
          select(eventId);
          setWhyCard(null);
        }}
      />
    </section>
  );
}

function WireCardView({
  card,
  status,
  nowIso,
  fixture,
  signedIn,
  shareNote,
  onWhy,
  onShare,
}: {
  card: WireCard;
  status: WireChromeStatus;
  nowIso: string;
  fixture: boolean;
  signedIn: boolean;
  shareNote: string | null;
  onWhy: () => void;
  onShare: (eventId: string) => void;
}) {
  const muted = isCardMuted(card);
  const rising = shouldPulseRising(status, card);
  const entity = cardEntity(card);
  const asOf = cardAsOf(card, nowIso);
  const values = formatValuePair(card.value, card.previousValue);
  const confirm = staleConfirmLine(card);
  const signedHint = signedIn ? null : 'Sign in keeps this event';

  return (
    <article
      className={`${styles.card} ${muted ? styles.cardMuted : ''}`}
      data-card-delta={card.delta}
      data-card-muted={muted ? 'true' : 'false'}
      data-card-rising={rising ? 'true' : 'false'}
    >
      <div className={styles.cardTop}>
        <div className={styles.entity}>
          <p className="text-[10px] tracking-[.16em] uppercase text-brass-bright">
            <span className={rising ? styles.rising : undefined}>{cardBadge(card)}</span>
            {fixture && ' · Fixture'}
          </p>
          {entity && <p className="text-sm leading-snug mt-1">{entity}</p>}
        </div>
        <p
          className={`${styles.asOf} text-[10px] tracking-[.12em] uppercase text-ink-muted`}
          title={asOf.absolute ?? undefined}
        >
          {asOf.label}
        </p>
      </div>

      <p className="text-sm leading-snug mt-2">{card.headline}</p>
      <p className="text-xs leading-relaxed text-ink-muted mt-1">{cardMeta(card)}</p>
      {values && (
        <p className="text-xs leading-relaxed text-ink-muted mt-1">{values}</p>
      )}
      {confirm && (
        <p className="text-xs leading-relaxed text-ink-muted mt-1">{confirm}</p>
      )}

      <div className={styles.actions}>
        {WIRE_ACTIONS.map((action) => (
          <WireAction
            key={action.id}
            action={action.id}
            label={action.label}
            eventId={card.eventId}
            needsEntity={action.needsEntity}
            signedHint={action.needsAuth ? signedHint : null}
            onWhy={onWhy}
            onShare={onShare}
          />
        ))}
      </div>
      {shareNote && (
        <p className="text-[10px] text-ink-muted mt-2">{shareNote}</p>
      )}
    </article>
  );
}

function WireAction({
  action,
  label,
  eventId,
  needsEntity,
  signedHint,
  onWhy,
  onShare,
}: {
  action: WireActionId;
  label: string;
  eventId?: string;
  needsEntity: boolean;
  signedHint: string | null;
  onWhy: () => void;
  onShare: (eventId: string) => void;
}) {
  if (action === 'why') {
    return (
      <Button variant="ghost" size="sm" onClick={onWhy}>
        {label}
      </Button>
    );
  }
  if (needsEntity && !eventId) {
    return (
      <Button variant="quiet" size="sm" disabled>
        {label}
      </Button>
    );
  }
  if (action === 'share' && eventId) {
    return (
      <Button variant="quiet" size="sm" onClick={() => onShare(eventId)}>
        {label}
      </Button>
    );
  }
  const href = actionHref(action, eventId);
  if (!href) {
    return (
      <Button variant="quiet" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <Button
      variant="quiet"
      size="sm"
      title={signedHint ?? undefined}
      onClick={() => {
        window.location.assign(href);
      }}
    >
      {label}
    </Button>
  );
}

function WhySheet({
  card,
  onClose,
  onOpenEvent,
}: {
  card: WireCard | null;
  onClose: () => void;
  onOpenEvent: (eventId: string) => void;
}) {
  const open = Boolean(card);
  const destination = eventHref(card?.eventId);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Why this travel wire card"
      width="min(28rem, 92vw)"
    >
      {card && (
        <div className={styles.whyBody}>
          <p className="text-[10px] tracking-[.16em] uppercase text-brass-bright">
            WHY?
          </p>
          <p className="font-display text-[15px] leading-5 text-ink">{card.headline}</p>
          <dl className={styles.whyRows}>
            {whyRows(card).map((row) => (
              <div key={row.label} className={styles.whyRow}>
                <dt className="text-[10px] tracking-[.12em] uppercase text-ink-muted">
                  {row.label}
                </dt>
                <dd className="text-xs text-ink text-right">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs leading-relaxed text-ink-muted">{card.detail}</p>
          <div className={styles.actions}>
            {card.eventId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenEvent(card.eventId as string)}
              >
                Open this event
              </Button>
            )}
            {destination && (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => {
                  window.location.assign(destination);
                }}
              >
                Open destination
              </Button>
            )}
            <Button variant="quiet" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
