/**
 * The Wire: eclectic, Vice-style travel reporting, one beat at a time. The
 * daily agent (docs/agents/daily-scout.md) searches each beat, and every
 * story it proposes must satisfy the story rules below before it is shown.
 * Nothing here fetches; it is the contract the agent and the UI share.
 */

export type BeatId = 'medical' | 'psychedelic' | 'wild' | 'adults-only' | 'new-sports' | 'hacks' | 'gear' | 'hot';

export type Beat = {
  id: BeatId;
  name: string;
  pitch: string;
  /** Seed searches; the agent adds the traveler's own interests. */
  queries: string[];
  /** Shown on every story in this beat. */
  label?: string;
  /** Links the story may never carry (booking, dosing, sales). */
  noLinks?: RegExp;
};

export const BEATS: Beat[] = [
  {
    id: 'medical',
    name: 'Medical travel',
    pitch: 'Where people fly for treatment, what it costs, and what can go wrong.',
    queries: ['medical tourism clinics abroad report', 'stem cell clinic travel investigation', 'dental tourism Mexico Hungary costs'],
    label: 'Reporting, not medical advice',
    noLinks: /book|appointment|consult|quote/i,
  },
  {
    id: 'psychedelic',
    name: 'Psychedelic retreats',
    pitch: 'Ayahuasca in Peru, psilocybin in Jamaica and the Netherlands: the scene, the law, the risks.',
    queries: ['ayahuasca retreat Peru investigation', 'psilocybin retreat legal Jamaica Netherlands', 'psychedelic tourism safety'],
    label: 'Reporting, not advice. Check the law where you are going.',
    noLinks: /book|dose|dosage|buy|order/i,
  },
  {
    id: 'wild',
    name: 'Exotic fishing & hunting',
    pitch: 'Peacock bass in the Amazon, GTs in the Seychelles, licensed hunts and the debates around them.',
    queries: ['exotic fishing trip destination feature', 'giant trevally fly fishing Seychelles', 'licensed hunting travel conservation debate'],
  },
  {
    id: 'adults-only',
    name: 'Adults-only escapes',
    pitch: 'The newest adults-only resorts and grown-up hideaways worth the flight.',
    queries: ['new adults-only resort opening', 'best adults only hotels new 2026'],
  },
  {
    id: 'new-sports',
    name: 'New sports & odd competitions',
    pitch: 'Padel tourism, underwater hockey, bog snorkelling: the sports people now travel for.',
    queries: ['new sport travel trend', 'strange sporting competitions travel', 'padel holiday trend'],
  },
  {
    id: 'hacks',
    name: 'Travel hacks',
    pitch: 'Points, fare quirks and border tricks that actually work, with the fine print.',
    queries: ['travel hack airline miles new', 'fare loophole travel news'],
  },
  {
    id: 'gear',
    name: 'Gear worth owning',
    pitch: 'Luggage, packs and gadgets that earn their weight, tested by people who travel.',
    queries: ['best carry on luggage review new', 'travel gear review tested'],
  },
  {
    id: 'hot',
    name: 'Hot right now',
    pitch: 'The places, parties and openings everyone will be talking about next season.',
    queries: ['hottest new travel destination next year', 'new festival travel destination'],
  },
];

export type WireStory = {
  beat: BeatId;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string;
  excerpt: string;
  image?: { url: string; credit: string; license?: string };
  /** Why it matches this traveler, in one line; never invented facts. */
  why?: string;
};

/**
 * The story rules: a real source link, a date within 45 days, a short excerpt
 * (quoted, not rewritten), and nothing from a beat's banned-link list.
 */
export function storyProblems(story: WireStory, now: Date = new Date()): string[] {
  const problems: string[] = [];
  const beat = BEATS.find((entry) => entry.id === story.beat);
  if (!beat) problems.push('unknown beat');
  let url: URL | null = null;
  try {
    url = new URL(story.url);
  } catch {
    problems.push('link is not a URL');
  }
  if (url && url.protocol !== 'https:') problems.push('link must be https');
  if (beat?.noLinks && beat.noLinks.test(story.url)) problems.push(`this beat never links to ${beat.noLinks.source}`);
  const published = Date.parse(story.publishedAt);
  if (!Number.isFinite(published)) problems.push('no publish date');
  else if (now.getTime() - published > 45 * 86_400_000) problems.push('older than 45 days');
  else if (published - now.getTime() > 86_400_000) problems.push('dated in the future');
  if (!story.title.trim() || story.title.length > 160) problems.push('title missing or too long');
  if (!story.publisher.trim()) problems.push('no publisher');
  if (story.excerpt.length > 400) problems.push('excerpt over 400 characters');
  return problems;
}
