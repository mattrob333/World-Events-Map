'use client';

import { AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DesignerCard } from '@/lib/designer/catalog';
import type { Participant } from '@/lib/designer/itinerary';
import styles from './designer.module.css';

const THRESHOLD = 110;

type Props = {
  title: string;
  cards: DesignerCard[];
  voter: Participant;
  participants: Participant[];
  onVoterChange: (id: string) => void;
  onVote: (cardId: string, value: 1 | -1) => void;
  onPick: (cardId: string) => void;
  onClose: () => void;
};

function TopCard({ card, onDecide }: { card: DesignerCard; onDecide: (value: 1 | -1) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const love = useTransform(x, [20, THRESHOLD], [0, 1]);
  const pass = useTransform(x, [-THRESHOLD, -20], [1, 0]);
  const [a, b] = card.palette;

  function end(_: unknown, info: PanInfo) {
    if (info.offset.x > THRESHOLD || info.velocity.x > 600) onDecide(1);
    else if (info.offset.x < -THRESHOLD || info.velocity.x < -600) onDecide(-1);
  }

  return (
    <motion.div
      className={styles.deckCard}
      style={{ x, rotate, background: `linear-gradient(160deg, ${a}, ${b})` }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={end}
      initial={{ scale: 0.94, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      {card.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local editorial files */}
          <img className={styles.heroImage} src={card.image} alt="" draggable={false} />
          <span className={styles.heroShade} />
        </>
      ) : (
        <span className="absolute inset-0 -z-10 grid place-items-center text-[120px]" aria-hidden>
          {card.emoji}
        </span>
      )}
      <motion.span className={styles.deckStamp} style={{ opacity: love, left: 24, color: '#4ade80', rotate: -12 }}>
        LOVE IT
      </motion.span>
      <motion.span className={styles.deckStamp} style={{ opacity: pass, right: 24, color: '#f87171', rotate: 12 }}>
        PASS
      </motion.span>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">{card.media === 'poster' ? 'Idea' : card.media}</p>
      <h3 className="mt-1 font-display text-[32px] leading-none">{card.title}</h3>
      <p className="mt-2 text-[14px] leading-6 opacity-90">{card.blurb}</p>
    </motion.div>
  );
}

/** Tinder-style pass through one slot's options for the active voter. */
export function SwipeDeck({ title, cards, voter, participants, onVoterChange, onVote, onPick, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const card = cards[index];

  const decide = useCallback(
    (value: 1 | -1) => {
      if (!card) return;
      onVote(card.id, value);
      setIndex((i) => i + 1);
    },
    [card, onVote],
  );

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') decide(1);
      else if (event.key === 'ArrowLeft') decide(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, onClose]);

  return (
    <div className={styles.deckBackdrop} role="dialog" aria-modal="true" aria-label={`Swipe through ${title}`}>
      <div className="grid w-full max-w-[380px] justify-items-center gap-3">
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-[13px] text-ink-muted">
            <span className={styles.avatar} style={{ background: voter.color, display: 'inline-grid', marginRight: 8 }}>
              {voter.emoji}
            </span>
            Swiping as {voter.name} · {title}
          </p>
          <button ref={closeRef} type="button" className={styles.miniBtn} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={styles.deck}>
          <AnimatePresence mode={reduced ? 'wait' : 'popLayout'}>
            {card ? (
              <TopCard key={card.id} card={card} onDecide={decide} />
            ) : (
              <motion.div key="done" className={`${styles.deckCard} grid place-items-center text-center`} style={{ background: 'linear-gradient(160deg,#f97316,#db2777)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div>
                  <p className="text-[64px]" aria-hidden>🎉</p>
                  <p className="font-display text-[30px]">That’s every option.</p>
                  <p className="mt-2 text-[14px] opacity-90">Pass the phone. Who’s next?</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {participants
                      .filter((person) => person.id !== voter.id)
                      .map((person) => (
                        <button key={person.id} type="button" className={styles.traveler} onClick={() => onVoterChange(person.id)}>
                          <span className={styles.avatar} style={{ background: person.color }}>
                            {person.emoji}
                          </span>
                          {person.name}
                        </button>
                      ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <p className="text-[12px] text-ink-faint" aria-live="polite">
          {card ? `${index + 1} of ${cards.length} · swipe right to love, left to pass` : `${cards.length} of ${cards.length}`}
        </p>
        {card ? (
          <div className={styles.deckControls}>
            <button type="button" className={styles.deckBtn} onClick={() => decide(-1)} aria-label={`Pass on ${card.title}`}>
              ✕
            </button>
            <button
              type="button"
              className={styles.deckBtn}
              onClick={() => {
                onPick(card.id);
                decide(1);
              }}
              aria-label={`Make ${card.title} the pick`}
            >
              ★
            </button>
            <button type="button" className={styles.deckBtn} onClick={() => decide(1)} aria-label={`Love ${card.title}`}>
              ♥
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
