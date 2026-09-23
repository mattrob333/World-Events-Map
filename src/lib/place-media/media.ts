import type { WorldEvent } from '@/lib/types';

export interface PlacePhoto {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  credit: string;
  license: string;
  photographed: string | null;
  subject: 'event' | 'place';
}

type MetadataValue = { value?: unknown };
type ImageInfo = {
  thumburl?: unknown;
  url?: unknown;
  descriptionurl?: unknown;
  mime?: unknown;
  extmetadata?: Record<string, MetadataValue>;
};
type CommonsPage = { title?: unknown; imageinfo?: ImageInfo[] };

const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const SOURCE_HOSTS = new Set(['commons.wikimedia.org']);
const STOP_WORDS = new Set(['the', 'and', 'of', 'de', 'la', 'di', 'le', 'at', 'in', 'for', '2026', '2027']);
const SPECIMEN_TITLE = /\b(?:specimen|dorsal|ventral|holotype|paratype|MHNT)\b/i;

export function approvedWikimediaUrl(value: unknown, purpose: 'image' | 'source'): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    if (purpose === 'image') return IMAGE_HOSTS.has(url.hostname) && url.pathname.startsWith('/wikipedia/');
    return SOURCE_HOSTS.has(url.hostname) && url.pathname.startsWith('/wiki/File:');
  } catch {
    return false;
  }
}

/** Commons extmetadata is HTML; keep only plain, bounded text in the client payload. */
export function plainMetadata(value: unknown, max = 140): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function words(value: string): string[] {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

export function isEventPhotoTitle(title: string, event: WorldEvent): boolean {
  const titleWords = new Set(words(title));
  const subjectWords = words(event.name);
  if (!subjectWords.length) return false;
  const matchCount = subjectWords.filter((word) => titleWords.has(word)).length;
  const cityMatch = words(event.city).every((word) => titleWords.has(word));
  const distinctiveNameMatch = matchCount >= 3 && matchCount >= Math.ceil(subjectWords.length * 0.6);
  return (cityMatch && matchCount >= Math.min(2, subjectWords.length)) || distinctiveNameMatch;
}

/** A century-old namesake exhibition is not useful scene imagery for today's fair. */
export function isRecentEventArchive(photo: PlacePhoto, event: WorldEvent): boolean {
  if (photo.subject !== 'event') return true;
  const year = photo.photographed?.match(/\b(?:18|19|20)\d{2}\b/)?.[0];
  return !year || Number(year) >= Number(event.start.slice(0, 4)) - 35;
}

export function selectCommonsPhotos(rawPages: unknown, event: WorldEvent, subject: 'event' | 'place', max = 5): PlacePhoto[] {
  if (!rawPages || typeof rawPages !== 'object') return [];
  const pages = Object.values(rawPages as Record<string, CommonsPage>);
  const photos: PlacePhoto[] = [];
  for (const page of pages) {
    if (typeof page?.title !== 'string' || !page.title.startsWith('File:')) continue;
    if (subject === 'event' && !isEventPhotoTitle(page.title, event)) continue;
    if (subject === 'place' &&
        (!words(event.city).every((word) => words(page.title as string).includes(word)) ||
          SPECIMEN_TITLE.test(page.title))) continue;
    const info = page.imageinfo?.[0];
    if (!info || info.mime !== 'image/jpeg') continue;
    const imageUrl = info.thumburl ?? info.url;
    if (!approvedWikimediaUrl(imageUrl, 'image') || !approvedWikimediaUrl(info.descriptionurl, 'source')) continue;
    const meta = info.extmetadata;
    const license = plainMetadata(meta?.LicenseShortName?.value, 70);
    if (!/^(CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/i.test(license)) continue;
    const credit = plainMetadata(meta?.Artist?.value ?? meta?.Credit?.value, 130) || 'Wikimedia Commons contributor';
    const date = plainMetadata(meta?.DateTimeOriginal?.value, 60);
    photos.push({
      title: plainMetadata(page.title.slice(5).replace(/\.[^.]+$/, '').replace(/_/g, ' '), 100),
      imageUrl,
      sourceUrl: info.descriptionurl,
      credit,
      license,
      photographed: date || null,
      subject,
    });
    if (photos.length >= max) break;
  }
  return photos;
}
