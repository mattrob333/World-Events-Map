import { formatCount, formatDelta } from '@/lib/heat/score';
import type { HeatTicker as Ticker } from '@/lib/heat/types';
import styles from './heat.module.css';
import { SourceLogo } from '@/components/brand/SourceLogo';

/** A tiny sparkline: gaps stay gaps (a missing day is not a zero). */
function Spark({ points, direction }: { points: Ticker['spark']; direction: Ticker['direction'] }) {
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const w = 64;
  const h = 22;
  const step = w / Math.max(1, points.length - 1);
  let d = '';
  let pen = false;
  points.forEach((point, i) => {
    if (point.value === null) {
      pen = false;
      return;
    }
    const x = (i * step).toFixed(1);
    const y = (h - 2 - ((point.value - min) / span) * (h - 4)).toFixed(1);
    d += `${pen ? 'L' : 'M'}${x} ${y} `;
    pen = true;
  });
  return (
    <svg className={styles.spark} data-direction={direction} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <path d={d.trim()} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The ticker: arrow, the week-over-week change, the daily number, and which
 * source it is. No arrow color on low confidence; relative sources would say
 * "index" (all Phase 1 sources are real counts).
 */
export function HeatTicker({ ticker, compact = false }: { ticker: Ticker; compact?: boolean }) {
  const head = ticker.headline;
  if (!head) return null;
  const delta = formatDelta(head.deltaPct);
  const arrow = ticker.direction === 'up' ? '▲' : ticker.direction === 'down' ? '▼' : '•';
  const per = head.absolute ? `${formatCount(head.perDay)} ${head.unit}/day` : 'index';
  return (
    <span className={`${styles.ticker} ${compact ? styles.compact : ''}`} data-direction={ticker.direction} title={`${head.sourceLabel}: last 7 days against the 3 weeks before. Confidence ${ticker.confidence}.`}>
      <Spark points={ticker.spark} direction={ticker.direction} />
      <span className={styles.move}>
        <span aria-hidden="true">{arrow}</span> {delta ?? 'new'}
      </span>
      {!compact && <span className={styles.per}>{per}</span>}
      {head.source === 'wikipedia' ? (
        // The mark says it at a glance and fits the narrow ticker; screen readers get the name.
        <span className={styles.source}><SourceLogo source="wikipedia" size={14} /><span className="sr-only">Wikipedia</span></span>
      ) : (
        <span className={styles.source}>News</span>
      )}
    </span>
  );
}
