import derivatives from './editorial-derivatives.json';
import { approvedWikimediaUrl } from './media';

/**
 * Responsive image attributes for a place photograph.
 *
 * - Local editorial originals (/editorial/<name>.jpg) have pre-built WebP copies
 *   (scripts/editorial-derivatives.mjs); the JPEG stays as `src` for fallback.
 * - Wikimedia Commons photos are hotlinked. Wikimedia rejects hotlinked
 *   thumbnails that are not one of its standard widths (HTTP 400) and rate-limits
 *   originals, so srcset only ever names standard widths on the thumbnail host.
 *
 * Neither path uses the Next.js image optimizer: it would spend the Vercel image
 * quota and make Wikimedia see all traffic from a few server IPs.
 */

export type PhotoSlot = 'hero' | 'heroFrame' | 'side' | 'card' | 'pass' | 'gallery';

/** `sizes` per layout slot; values track the CSS that frames each slot. */
export const PHOTO_SIZES: Record<PhotoSlot, string> = {
  hero: '(max-width: 740px) 100vw, 70vw',
  heroFrame: '(max-width: 740px) 100vw, 36rem',
  side: '(max-width: 740px) 50vw, 28vw',
  card: '(max-width: 650px) 80vw, 320px',
  pass: '(max-width: 900px) 90vw, 460px',
  gallery: '(max-width: 740px) 100vw, 440px',
};

// https://www.mediawiki.org/wiki/Common_thumbnail_sizes (production standard widths)
export const COMMONS_STANDARD_WIDTHS = [330, 500, 960, 1280] as const;
const COMMONS_THUMB_HOST = 'https://thumb.wikimedia.org';
const EDITORIAL = derivatives as Record<string, number[]>;
const THUMB_PATH = /^\/wikipedia\/commons\/thumb\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)\/(\d+)px-([^/]+)$/;
const ORIGINAL_PATH = /^\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+\.jpe?g)$/i;
// MediaWiki abbreviates long thumbnail names; skip srcset rather than guess.
const MAX_THUMB_NAME_BYTES = 160;

export type PhotoImageProps = { src: string; srcSet?: string; sizes?: string };

export function photoImageProps(photo: { imageUrl: string; width?: number }, slot: PhotoSlot): PhotoImageProps {
  const sizes = PHOTO_SIZES[slot];
  const local = photo.imageUrl.match(/^\/editorial\/([a-z0-9-]+)\.jpe?g$/);
  if (local) {
    const widths = EDITORIAL[local[1]];
    if (!widths?.length) return { src: photo.imageUrl };
    return { src: photo.imageUrl, srcSet: widths.map((w) => `/editorial/w${w}/${local[1]}.webp ${w}w`).join(', '), sizes };
  }
  const srcSet = commonsSrcSet(photo.imageUrl, photo.width);
  return srcSet ? { src: srcSet.src, srcSet: srcSet.srcSet, sizes } : { src: photo.imageUrl };
}

function commonsSrcSet(imageUrl: string, originalWidth?: number): { src: string; srcSet: string } | null {
  if (!approvedWikimediaUrl(imageUrl, 'image')) return null;
  const { pathname } = new URL(imageUrl);
  const thumb = pathname.match(THUMB_PATH);
  const original = thumb ? null : pathname.match(ORIGINAL_PATH);
  if (!thumb && !original) return null;
  const [, a, ab, name] = (thumb ?? original)!;
  const suffix = thumb ? thumb[5] : name;
  if (!thumb && byteLength(name) > MAX_THUMB_NAME_BYTES) return null;
  // A thumbnail URL caps the useful widths at its own. For an original (Commons
  // returns one when it is smaller than the 1280 we ask for) the cap is the first
  // standard width that covers it: Wikimedia serves that thumbnail, while the
  // original itself on upload.wikimedia.org is rate-limited for hotlinking.
  const cap = thumb
    ? Number(thumb[4])
    : COMMONS_STANDARD_WIDTHS.find((w) => w >= (originalWidth ?? 960)) ?? COMMONS_STANDARD_WIDTHS.at(-1)!;
  const widths = COMMONS_STANDARD_WIDTHS.filter((w) => w <= cap);
  if (!widths.length) return null;
  const url = (w: number) => `${COMMONS_THUMB_HOST}/wikipedia/commons/thumb/${a}/${ab}/${name}/${w}px-${suffix}`;
  const entries = widths.map((w) => `${url(w)} ${w}w`);
  const largest = widths.at(-1)!;
  return { src: url(largest), srcSet: entries.join(', ') };
}

function byteLength(value: string): number {
  try {
    return new TextEncoder().encode(decodeURIComponent(value)).length;
  } catch {
    return value.length;
  }
}
