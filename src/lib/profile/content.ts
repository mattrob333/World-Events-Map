export type TravelContentProvider =
  | 'youtube'
  | 'instagram'
  | 'tiktok'
  | 'image'
  | 'web'
  | 'other';

const IMAGE_EXTENSIONS = /\.(avif|gif|jpe?g|png|webp)(?:$|\?)/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function detectContentProvider(value: string): TravelContentProvider {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return 'other';
  const url = new URL(normalized);
  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be' || host.endsWith('youtube.com')) return 'youtube';
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (IMAGE_EXTENSIONS.test(`${url.pathname}${url.search}`)) return 'image';
  return 'web';
}

export function youtubeVideoId(value: string): string | null {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return null;
  const url = new URL(normalized);
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let candidate = '';

  if (host === 'youtu.be') {
    candidate = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else if (host.endsWith('youtube.com')) {
    candidate = url.searchParams.get('v') ?? '';
    if (!candidate) {
      const parts = url.pathname.split('/').filter(Boolean);
      if (['shorts', 'embed', 'live'].includes(parts[0] ?? '')) {
        candidate = parts[1] ?? '';
      }
    }
  }

  return YOUTUBE_ID.test(candidate) ? candidate : null;
}

export function displayHost(value: string): string {
  const normalized = normalizeExternalUrl(value);
  if (!normalized) return 'External link';
  return new URL(normalized).hostname.replace(/^www\./, '');
}
