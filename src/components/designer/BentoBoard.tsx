'use client';

import type { BentoCard } from '@/lib/designer/moodboard';
import styles from './designer.module.css';

function Card({ card }: { card: BentoCard }) {
  const [a, b] = card.palette;
  return (
    <article
      className={`${styles.bento} ${styles[`bento_${card.size}`]} ${card.image ? styles.bentoPhoto : ''}`}
      data-kind={card.kind}
      style={{ ['--a' as string]: a, ['--b' as string]: b }}
      aria-label={`${card.eyebrow}: ${card.title}`}
    >
      {card.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local editorial files, decorative mood imagery */}
          <img className={styles.bentoImage} src={card.image} alt="" loading="lazy" />
          <span className={styles.bentoShade} />
        </>
      ) : null}
      <div className={styles.bentoTop}>
        <span className={styles.bentoEyebrow}>{card.eyebrow}</span>
        <span className={styles.bentoEmoji} aria-hidden>
          {card.emoji}
        </span>
      </div>
      <div className={styles.bentoMain}>
        <h3 className={styles.bentoTitle}>{card.title}</h3>
        {card.body ? <p className={styles.bentoBody}>{card.body}</p> : null}
        {card.meters?.length ? (
          <div className={styles.meters}>
            {card.meters.map((meter) => (
              <div key={meter.label} className={styles.meter}>
                <span>{meter.label}</span>
                <span className={styles.meterTrack} aria-hidden>
                  <span style={{ width: `${Math.round(meter.value * 100)}%` }} />
                </span>
                <span>{Math.round(meter.value * 100)}%</span>
              </div>
            ))}
          </div>
        ) : null}
        {card.items?.length ? (
          <ul className={styles.bentoItems}>
            {card.items.map((item, index) => (
              <li key={`${item.label}-${index}`} className={styles.bentoItem}>
                {item.emoji ? <span aria-hidden>{item.emoji}</span> : null}
                <span>{item.label}</span>
                {item.sub ? <span className={styles.bentoItemSub}>{item.sub}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function BentoBoard({ cards }: { cards: BentoCard[] }) {
  return (
    <div className={styles.bentoGrid}>
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  );
}
