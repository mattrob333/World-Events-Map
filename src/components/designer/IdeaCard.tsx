'use client';

import type { DragEvent } from 'react';
import type { DesignerCard } from '@/lib/designer/catalog';
import type { Participant } from '@/lib/designer/itinerary';
import { tally, type CardVotes } from '@/lib/designer/votes';
import styles from './designer.module.css';

export const DRAG_MIME = 'application/x-meridian-card';

const MEDIA_TAG: Record<DesignerCard['media'], string> = {
  video: '▶ Video idea',
  reel: '◎ Reel idea',
  photo: 'Photo',
  poster: 'Idea',
};

export function CardArt({ card, lead }: { card: DesignerCard; lead?: boolean }) {
  const [a, b] = card.palette;
  return (
    <div
      className={`${styles.cardMedia} ${card.media === 'photo' ? styles.cardMediaPhoto : ''}`}
      style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
    >
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- local editorial files
        <img className={styles.cardImg} src={card.image} alt="" loading="lazy" draggable={false} />
      ) : null}
      <span className={styles.cardEmoji} aria-hidden>
        {card.emoji}
      </span>
      {card.media === 'video' ? (
        <span className={styles.play} aria-hidden>
          <span>▶</span>
        </span>
      ) : null}
      <span className={styles.mediaTag}>{MEDIA_TAG[card.media]}</span>
      {lead ? <span className={styles.leadRibbon}>THE PICK</span> : null}
    </div>
  );
}

type Props = {
  card: DesignerCard;
  slotId: string;
  index: number;
  lead: boolean;
  votes: CardVotes | undefined;
  participants: Participant[];
  voter: Participant | undefined;
  dragging: boolean;
  moveTargets: { id: string; label: string }[];
  onVote: (value: 1 | -1) => void;
  onPick: () => void;
  onMove: (toSlot: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

/** "google.com", "youtube.com": so a card never hides where its link goes. */
function linkHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function IdeaCard({
  card,
  slotId,
  index,
  lead,
  votes,
  participants,
  voter,
  dragging,
  moveTargets,
  onVote,
  onPick,
  onMove,
  onDragStart,
  onDragEnd,
}: Props) {
  const mine = voter ? votes?.[voter.id] : undefined;
  const { up, down } = tally(votes);
  const lovers = participants.filter((person) => votes?.[person.id] === 1);

  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ cardId: card.id, from: slotId }));
    event.dataTransfer.setData('text/plain', card.title);
    onDragStart();
  }

  return (
    <article
      className={`${styles.card} ${lead ? styles.cardLead : ''} ${dragging ? styles.cardDragging : ''}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      data-card-index={index}
      aria-label={`${card.title}${lead ? ', the current pick' : ''}`}
    >
      <CardArt card={card} lead={lead} />
      <div className={styles.cardBody}>
        <h4 className={styles.cardTitle}>{card.title}</h4>
        <p className={styles.cardBlurb}>{card.blurb}</p>
        {card.link ? (
          <a className={styles.cardLink} href={card.link.href} target="_blank" rel="noopener noreferrer">
            {card.link.label} ↗<span className="ml-1 opacity-70">· {linkHost(card.link.href)}</span>
          </a>
        ) : null}
      </div>
      <div className={styles.cardFoot}>
        <button
          type="button"
          className={`${styles.voteBtn} ${mine === 1 ? styles.voteOn : ''}`}
          onClick={onVote.bind(null, 1)}
          disabled={!voter}
          aria-pressed={mine === 1}
          aria-label={`${voter ? `${voter.name} loves` : 'Love'} ${card.title}`}
        >
          👍 {up || ''}
        </button>
        <button
          type="button"
          className={`${styles.voteBtn} ${mine === -1 ? styles.voteOff : ''}`}
          onClick={onVote.bind(null, -1)}
          disabled={!voter}
          aria-pressed={mine === -1}
          aria-label={`${voter ? `${voter.name} passes on` : 'Pass on'} ${card.title}`}
        >
          👎 {down || ''}
        </button>
        {!lead ? (
          <button type="button" className={styles.voteBtn} onClick={onPick} aria-label={`Make ${card.title} the pick`} title="Make it the pick">
            ★
          </button>
        ) : null}
        <span className={styles.voters} aria-label={lovers.length ? `Loved by ${lovers.map((p) => p.name).join(', ')}` : undefined}>
          {lovers.slice(0, 4).map((person) => (
            <span key={person.id} style={{ background: person.color }} title={person.name}>
              {person.emoji}
            </span>
          ))}
        </span>
      </div>
      <label className={styles.srOnly} htmlFor={`move-${slotId}-${card.id}`}>
        Move {card.title} to another time slot
      </label>
      <select
        id={`move-${slotId}-${card.id}`}
        className={styles.moveSelect}
        value=""
        onChange={(event) => event.target.value && onMove(event.target.value)}
      >
        <option value="">Move to…</option>
        {moveTargets.map((target) => (
          <option key={target.id} value={target.id}>
            {target.label}
          </option>
        ))}
      </select>
    </article>
  );
}
