import { describe, expect, it } from 'vitest';
import { BEATS, storyProblems, type WireStory } from './beats';

const now = new Date('2026-09-24T12:00:00Z');
const story = (patch: Partial<WireStory> = {}): WireStory => ({
  beat: 'psychedelic', title: 'Inside the ayahuasca boom', url: 'https://example.com/story', publisher: 'Example', publishedAt: '2026-09-20', excerpt: 'A quote.', ...patch,
});

describe('The Wire story rules', () => {
  it('accepts a sourced, dated, short story', () => {
    expect(storyProblems(story(), now)).toEqual([]);
  });

  it('labels medical and psychedelic beats as reporting, not advice', () => {
    for (const id of ['medical', 'psychedelic']) expect(BEATS.find((b) => b.id === id)?.label).toMatch(/not .*advice/i);
  });

  it('refuses booking or dosing links on sensitive beats', () => {
    expect(storyProblems(story({ url: 'https://example.com/book-your-retreat' }), now)).not.toEqual([]);
    expect(storyProblems(story({ beat: 'medical', url: 'https://clinic.example/consult' }), now)).not.toEqual([]);
  });

  it('refuses stale, undated, or non-https stories', () => {
    expect(storyProblems(story({ publishedAt: '2026-06-01' }), now)).toContain('older than 45 days');
    expect(storyProblems(story({ publishedAt: 'soon' }), now)).toContain('no publish date');
    expect(storyProblems(story({ url: 'http://example.com/x' }), now)).toContain('link must be https');
  });
});
