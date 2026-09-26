import type { TravelCard } from '@/lib/people/card';
import styles from './people.module.css';

/** A traveler's card. `shared` highlights what the viewer has in common with them. */
export function TravelCardView({ card, shared = [] }: { card: TravelCard; shared?: readonly string[] }) {
  const common = new Set(shared.map((value) => value.toLowerCase()));
  const rows: [string, string[]][] = [
    ['Loves', card.loves],
    ['Music', card.music],
    ['Teams', card.teams],
    ['How they travel', card.style],
    ['Bucket list', card.bucketList],
  ];
  return (
    <article className={styles.card} aria-label={`${card.name}'s travel card`}>
      <div className={styles.cardTop}>
        <span className={styles.cardBrand}>Travel card · dope.travel</span>
        <span aria-hidden="true">✦</span>
      </div>
      <div>
        <h3 className={styles.cardName}>{card.name}</h3>
        {card.hometown ? <p className={styles.cardHome}>From {card.hometown}</p> : null}
      </div>
      {rows.filter(([, values]) => values.length).map(([label, values]) => (
        <div key={label} className={styles.row}>
          <span className={styles.rowLabel}>{label}</span>
          <span className={styles.chips}>
            {values.map((value) => (
              <span key={value} className={`${styles.chip} ${common.has(value.toLowerCase()) ? styles.chipShared : ''}`}>{value}</span>
            ))}
          </span>
        </div>
      ))}
    </article>
  );
}
