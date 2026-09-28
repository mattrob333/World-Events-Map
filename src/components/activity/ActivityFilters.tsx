'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { CATEGORIES, CATEGORY_META, MONTHS_LONG, MONTHS_SHORT, type Activity, type Category } from '@/lib/activity/activities';
import type { MonthSel } from '@/lib/activity/season';
import { useActivityStore } from '@/lib/activity/store';
import { CATEGORY_ICON } from './icons';
import { glyphColor } from './markerTextures';
import styles from './spot.module.css';

const MONTHS: MonthSel[] = ['now', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** A scrolling row that fades the edge it can still scroll toward, so it's clear there's more. */
function FadeRow({ children, ...rest }: { children: ReactNode; role: string; 'aria-label': string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  useEffect(() => {
    if (!el) return;
    const update = () => {
      const next = { start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    const resize = new ResizeObserver(update);
    resize.observe(el);
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      el.removeEventListener('scroll', update);
      resize.disconnect();
    };
  }, [el]);
  return (
    <div ref={setEl} className={styles.row} data-fade-start={edges.start || undefined} data-fade-end={edges.end || undefined} {...rest}>
      {children}
    </div>
  );
}

/**
 * When and what: a month row (Now, then January to December) and the kinds
 * of trip, with For you first when their profile has picks. Sits over the
 * top of the globe.
 */
export function ActivityFilters({ activities, forYouCount = 0 }: { activities: readonly Activity[]; forYouCount?: number }) {
  const month = useActivityStore((s) => s.month);
  const categories = useActivityStore((s) => s.categories);
  const forYou = useActivityStore((s) => s.forYou);
  const { setMonth, toggleCategory, setCategories, setForYou } = useActivityStore.getState();
  const counts = useMemo(() => {
    const c = Object.fromEntries(CATEGORIES.map((k) => [k, 0])) as Record<Category, number>;
    for (const a of activities) c[a.category] += 1;
    return c;
  }, [activities]);
  const all = !forYou && categories.length === 0;

  return (
    <div className={styles.filters}>
      <FadeRow role="radiogroup" aria-label="Month">
        {MONTHS.map((m) => {
          const on = month === m;
          return (
            <button key={String(m)} type="button" role="radio" aria-checked={on} aria-label={m === 'now' ? 'Now' : MONTHS_LONG[m - 1]} className={styles.month} data-on={on || undefined} onClick={() => setMonth(m)}>
              {m === 'now' ? 'Now' : MONTHS_SHORT[m - 1]}
            </button>
          );
        })}
      </FadeRow>
      <FadeRow role="group" aria-label="What kind of trip">
        {forYouCount > 0 ? (
          <button type="button" className={`${styles.chip} ${styles.chipForYou}`} data-on={forYou || undefined} aria-pressed={forYou} onClick={() => setForYou(!forYou)}>
            <span className={styles.chipDot} aria-hidden="true"><Sparkles size={12} strokeWidth={2.5} /></span>
            For you
          </button>
        ) : null}
        <button type="button" className={styles.chip} data-on={all || undefined} aria-pressed={all} onClick={() => setCategories([])}>
          All
        </button>
        {CATEGORIES.filter((c) => counts[c] > 0).map((c) => {
          const Icon = CATEGORY_ICON[c];
          const on = !forYou && categories.includes(c);
          const color = CATEGORY_META[c].color;
          return (
            <button key={c} type="button" className={styles.chip} data-on={on || undefined} aria-pressed={on} onClick={() => toggleCategory(c)}>
              <span className={styles.chipDot} style={{ background: color, color: glyphColor(color) }} aria-hidden="true">
                <Icon size={12} strokeWidth={2.5} />
              </span>
              {CATEGORY_META[c].label}
            </button>
          );
        })}
      </FadeRow>
    </div>
  );
}
