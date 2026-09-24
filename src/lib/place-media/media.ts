import type { EventCategory, WorldEvent } from '@/lib/types';

export interface PlacePhoto {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  credit: string;
  license: string;
  photographed: string | null;
  subject: 'event' | 'place';
  /** Original pixel size on Commons, when known; bounds the thumbnail widths we request. */
  width?: number;
  height?: number;
}

type MetadataValue = { value?: unknown };
type ImageInfo = {
  thumburl?: unknown;
  url?: unknown;
  descriptionurl?: unknown;
  mime?: unknown;
  width?: unknown;
  height?: unknown;
  extmetadata?: Record<string, MetadataValue>;
};
type CommonsPage = { title?: unknown; imageinfo?: ImageInfo[] };

const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const SOURCE_HOSTS = new Set(['commons.wikimedia.org']);
const STOP_WORDS = new Set(['the', 'and', 'of', 'de', 'la', 'di', 'le', 'at', 'in', 'for', '2026', '2027']);
const NON_SCENE_TITLE = /\b(?:specimen|dorsal|ventral|holotype|paratype|MHNT|ISS\d{2,}|satellite|logo|poster|postcard|ticket|stamp|map|diagram|illustration|inscription|schriftzug|darstellung|statue|monument|altar|stadtpark)\b/i;
const SKI_OFF_SEASON_TITLE = /\b(?:spring|summer|autumn|fall|hiking|biking|cycling|polo)\b/i;
const CRESTA_SCENE = /\b(?:cresta|skeleton|toboggan|ice channel)\b/i;

// A city match alone can return museums, aircraft, artwork, or a different
// occasion. These cues admit contextual place imagery, never event coverage.
const PLACE_SCENE: Record<EventCategory, RegExp> = {
  art: /\b(?:art|artist|gallery|exhibition|biennale|sculpture|installation|painting)\b/i,
  music: /\b(?:music|concert|jazz|festival|stage|performance|audience|orchestra|opera)\b/i,
  motorsport: /\b(?:race|racing|car|formula|circuit|motorsport|grand prix|paddock)\b/i,
  sailing: /\b(?:yacht|sail|boat|ship|marina|harbour|harbor|regatta|port)\b/i,
  ski: /\b(?:ski|skiing|snowboard|powder|pistes?|slopes?|chairlifts?|gondolas?)\b/i,
  culinary: /\b(?:food|restaurant|dining|chef|cuisine|wine|market|gastronomy|cooking)\b/i,
  fashion: /\b(?:fashion|runway|couture|catwalk|designer|model)\b/i,
  wellness: /\b(?:spa|wellness|yoga|retreat|thermal|hot springs?|onsen|bath)\b/i,
  safari: /\b(?:safari|wildlife|elephant|lion|zebra|wildebeest|rhino|giraffe|tiger|leopard)\b/i,
  equestrian: /\b(?:horse|racing|polo|pony|equestrian|stable|derby)\b/i,
  film: /\b(?:film|cinema|movie|screening|premiere|red carpet|festival)\b/i,
  design: /\b(?:design|architecture|exhibition|interior|furniture|gallery)\b/i,
  golf: /\b(?:golf|course|clubhouse|fairway|putting green)\b/i,
  tennis: /\b(?:tennis|racket|racquet|wimbledon|roland garros|laver cup)\b/i,
  nature: /\b(?:aurora|northern lights|cherry blossoms?|sakura|snow|ice|glacier|wildlife|penguin|whale|sea lions?|reef|coral|volcano|desert|rainforest|waterfall|mountain|cave|forest|sunset|beach|coast|island|ocean|dolphin|turtle|puma|manta|mangrove)\b/i,
  cultural: /\b(?:festival|carnival|diwali|oktoberfest|parade|lantern|sakura|cherry blossoms?|temple|ceremony|fireworks?|celebration|costume)\b/i,
  gala: /\b(?:gala|ball|benefit|black tie|red carpet|banquet|reception)\b/i,
};

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

function normalizedPhrase(value: string): string {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function namesTheOccasion(title: string, event: WorldEvent): boolean {
  const titleWords = new Set(words(title));
  const subjectWords = words(event.name);
  if (!subjectWords.length) return false;
  const matchCount = subjectWords.filter((word) => titleWords.has(word)).length;
  const cityMatch = words(event.city).every((word) => titleWords.has(word));
  return (cityMatch && matchCount >= Math.min(2, subjectWords.length)) ||
    (matchCount >= Math.min(2, subjectWords.length) && matchCount >= Math.ceil(subjectWords.length * 0.6));
}

function namesVenue(title: string, event: WorldEvent): boolean {
  const normalizedTitle = normalizedPhrase(title);
  return event.venues?.some((venue) => {
    const phrase = normalizedPhrase(venue).replace(/^the /, '');
    return phrase.length >= 7 && normalizedTitle.includes(phrase);
  }) ?? false;
}

export function isEventPhotoTitle(title: string, event: WorldEvent): boolean {
  // A seasonal travel window is not a photographed fixture, even when its
  // descriptive name happens to appear in a Commons filename.
  if (event.recurrence === 'seasonal' || NON_SCENE_TITLE.test(title)) return false;
  return namesTheOccasion(title, event);
}

export function isPlacePhotoTitle(title: string, event: WorldEvent): boolean {
  const titleWords = words(title);
  if (NON_SCENE_TITLE.test(title) || !words(event.city).every((word) => titleWords.includes(word))) return false;
  if (event.id === 'cresta-run-season-st-moritz') return CRESTA_SCENE.test(title) && namesVenue(title, event);
  if (!PLACE_SCENE[event.category].test(title)) return false;
  if (event.category === 'ski' && SKI_OFF_SEASON_TITLE.test(title)) return false;
  if (event.recurrence !== 'seasonal' && !namesTheOccasion(title, event) && !namesVenue(title, event)) return false;
  return true;
}

/** Keep event archives contemporary; unknown dates remain explicitly undated. */
export function isRecentEventArchive(photo: PlacePhoto, event: WorldEvent): boolean {
  if (photo.subject !== 'event') return true;
  const year = photo.photographed?.match(/\b(?:18|19|20)\d{2}\b/)?.[0]
    ?? photo.title.match(/\b(?:18|19|20)\d{2}\b/)?.[0];
  return !year || Number(year) >= Number(event.start.slice(0, 4)) - 10;
}

/** A December ski trip should not lead with an April or summer photo. */
export function isSeasonalPlacePhoto(photo: PlacePhoto, event: WorldEvent): boolean {
  if (photo.subject !== 'place' || event.category !== 'ski') return true;
  if (SKI_OFF_SEASON_TITLE.test(photo.title)) return false;
  const month = photo.photographed?.match(/\b(?:18|19|20)\d{2}-(\d{2})-\d{2}\b/)?.[1];
  if (!month) return true;
  const photoMonth = Number(month);
  const eventMonth = Number(event.start.slice(5, 7));
  const monthDistance = Math.min(Math.abs(photoMonth - eventMonth), 12 - Math.abs(photoMonth - eventMonth));
  return monthDistance <= 1;
}

function pixelSize(width: unknown, height: unknown): Pick<PlacePhoto, 'width' | 'height'> {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value < 100_000;
  return valid(width) && valid(height) ? { width, height } : {};
}

export function selectCommonsPhotos(rawPages: unknown, event: WorldEvent, subject: 'event' | 'place', max = 5): PlacePhoto[] {
  if (!rawPages || typeof rawPages !== 'object') return [];
  const pages = Object.values(rawPages as Record<string, CommonsPage>);
  const photos: PlacePhoto[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (typeof page?.title !== 'string' || !page.title.startsWith('File:')) continue;
    if (subject === 'event' && !isEventPhotoTitle(page.title, event)) continue;
    if (subject === 'place' && !isPlacePhotoTitle(page.title, event)) continue;
    const info = page.imageinfo?.[0];
    if (!info || info.mime !== 'image/jpeg') continue;
    const imageUrl = info.thumburl ?? info.url;
    if (!approvedWikimediaUrl(imageUrl, 'image') || !approvedWikimediaUrl(info.descriptionurl, 'source')) continue;
    if (seen.has(info.descriptionurl)) continue;
    const meta = info.extmetadata;
    const license = plainMetadata(meta?.LicenseShortName?.value, 70);
    if (!/^(CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/i.test(license)) continue;
    const credit = plainMetadata(meta?.Artist?.value ?? meta?.Credit?.value, 130) || 'Wikimedia Commons contributor';
    const date = plainMetadata(meta?.DateTimeOriginal?.value, 60);
    const photo: PlacePhoto = {
      title: plainMetadata(page.title.slice(5).replace(/\.[^.]+$/, '').replace(/_/g, ' '), 100),
      imageUrl,
      sourceUrl: info.descriptionurl,
      credit,
      license,
      photographed: date || null,
      subject,
      ...pixelSize(info.width, info.height),
    };
    if (!isSeasonalPlacePhoto(photo, event)) continue;
    seen.add(photo.sourceUrl);
    photos.push(photo);
    if (photos.length >= max) break;
  }
  return photos;
}
