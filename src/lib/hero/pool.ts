import pool from './pool.json';

/**
 * The home hero's photo pool: real, licensed photographs of people having a
 * great time, each labelled with where it was taken and credited. Reviewed
 * by hand (lively, really that place, no political or celebrity framing)
 * before entering the pool. Files are local WebP copies; credit and license
 * travel with every use.
 */
export type HeroPhoto = {
  id: string;
  scene: string;
  city: string;
  region: string;
  title: string;
  credit: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  /** Vertical focus for the wide hero crop, 0 (top) .. 100 (bottom): where the people are. */
  focusY?: number;
};

export const HERO_POOL: HeroPhoto[] = pool as HeroPhoto[];
export const HERO_WIDTHS = [800, 1600] as const;

export function heroSrc(photo: Pick<HeroPhoto, 'id'>, width: (typeof HERO_WIDTHS)[number]): string {
  return `/hero-pool/w${width}/${photo.id}.webp`;
}

export function heroSrcSet(photo: Pick<HeroPhoto, 'id'>): string {
  return HERO_WIDTHS.map((width) => `${heroSrc(photo, width)} ${width}w`).join(', ');
}

/**
 * A run of photos for one visit: unseen ones first (in random order), then
 * the least recently seen, never the same city twice in a row.
 */
export function heroRun(seen: readonly string[], count: number, random: () => number = Math.random, list: readonly HeroPhoto[] = HERO_POOL): HeroPhoto[] {
  const recency = new Map(seen.map((id, index) => [id, index]));
  const shuffled = [...list].map((photo) => ({ photo, key: random() })).sort((a, b) => a.key - b.key).map((entry) => entry.photo);
  const ordered = [
    ...shuffled.filter((photo) => !recency.has(photo.id)),
    ...shuffled.filter((photo) => recency.has(photo.id)).sort((a, b) => recency.get(a.id)! - recency.get(b.id)!),
  ];
  const run: HeroPhoto[] = [];
  const rest = [...ordered];
  while (run.length < Math.min(count, list.length) && rest.length) {
    const lastCity = run.at(-1)?.city;
    const index = rest.findIndex((photo) => photo.city !== lastCity);
    run.push(...rest.splice(index === -1 ? 0 : index, 1));
  }
  return run;
}

/** Adds shown ids to the seen list: oldest first, capped. */
export function markSeen(seen: readonly string[], shown: readonly string[], cap = 80): string[] {
  const next = seen.filter((id) => !shown.includes(id));
  return [...next, ...shown].slice(-cap);
}
