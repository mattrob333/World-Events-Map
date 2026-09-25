'use client';

import type { DragEvent } from 'react';
import type { DesignerCard } from '@/lib/designer/catalog';
import type { Participant } from '@/lib/designer/itinerary';
import { tally, type CardVotes } from '@/lib/designer/votes';
import styles from './designer.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';

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
      className={styles.cardMedia}
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

/** An Uber/Lyft hand-off for a ride-to-the-airport card. */
export type RideOffer = { iata: string; name: string; uber: string; lyft: string };

type Props = {
  card: DesignerCard;
  ride?: RideOffer;
  slotId: string;
  index: number;
  lead: boolean;
  votes: CardVotes | undefined;
  participants: Participant[];
  voter: Participant | undefined;
  dragging: boolean;
  moveTargets: { id: string; label: string }[];
  onVote: (value: 1 | -1) => void;
  onOpen: () => void;
  onPick: () => void;
  onMove: (toSlot: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function IdeaCard({
  card,
  ride,
  slotId,
  index,
  lead,
  votes,
  participants,
  voter,
  dragging,
  moveTargets,
  onVote,
  onOpen,
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
        <h4 className={styles.cardTitle}>
          {/* Stretched over the art and text: the whole card opens its details. */}
          <button type="button" className={styles.cardOpen} onClick={onOpen} aria-haspopup="dialog">
            {ride ? `Ride to ${ride.iata}` : card.title}
          </button>
        </h4>
        {ride ? (
          <p className={styles.rideLinks}>
            <a href={ride.uber} target="_blank" rel="noopener noreferrer"><SourceLogo source={ride.uber} size={13} className="mr-1" />Uber ↗</a>
            <a href={ride.lyft} target="_blank" rel="noopener noreferrer"><SourceLogo source={ride.lyft} size={13} className="mr-1" />Lyft ↗</a>
          </p>
        ) : (
          <p className={styles.cardBlurb}>{card.blurb}</p>
        )}
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
