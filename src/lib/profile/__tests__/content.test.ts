import { describe, expect, it } from 'vitest';
import {
  detectContentProvider,
  displayHost,
  normalizeExternalUrl,
  youtubeVideoId,
} from '../content';

describe('travel content URL helpers', () => {
  it('accepts only https URLs', () => {
    expect(normalizeExternalUrl('https://example.com/path#section')).toBe(
      'https://example.com/path',
    );
    expect(normalizeExternalUrl('http://example.com')).toBeNull();
    expect(normalizeExternalUrl('javascript:alert(1)')).toBeNull();
  });

  it('detects common travel content providers', () => {
    expect(detectContentProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(detectContentProvider('https://www.instagram.com/p/abc123/')).toBe('instagram');
    expect(detectContentProvider('https://www.tiktok.com/@traveler/video/123')).toBe('tiktok');
    expect(detectContentProvider('https://cdn.example.com/courchevel.webp')).toBe('image');
    expect(detectContentProvider('https://example.com/guide')).toBe('web');
  });

  it('extracts YouTube IDs from watch, share, shorts and embed URLs', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=2')).toBe('dQw4w9WgXcQ');
    expect(youtubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(youtubeVideoId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
    expect(youtubeVideoId('https://youtube.com/watch?v=too-short')).toBeNull();
  });

  it('formats the host for generic cards', () => {
    expect(displayHost('https://www.cntraveler.com/story/example')).toBe('cntraveler.com');
    expect(displayHost('not a url')).toBe('External link');
  });
});
