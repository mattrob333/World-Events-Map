/**
 * A small, dependency-free RSS 2.0 / Atom reader for the source library.
 * It keeps only what the product may show: title, link, date and a short
 * plain-text excerpt (never full text, never markup).
 */

export const EXCERPT_MAX = 260;

export type FeedEntry = {
  title: string;
  url: string;
  publishedAt: string | null;
  excerpt: string;
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => safeChar(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => safeChar(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
}

function unwrap(text: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(text);
  return cdata ? cdata[1]! : text;
}

/** Plain text: CDATA unwrapped, tags stripped, entities decoded, whitespace collapsed. */
export function plainText(raw: string): string {
  const html = decode(unwrap(raw));
  return decode(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function tag(block: string, names: string[]): string | null {
  for (const name of names) {
    const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
    if (match) return match[1]!;
  }
  return null;
}

function atomLink(block: string): string | null {
  const links = [...block.matchAll(/<link\b([^>]*)\/?>/gi)].map((match) => match[1]!);
  const pick = links.find((attrs) => !/rel\s*=\s*["'](?!alternate)/i.test(attrs)) ?? links[0];
  const href = pick ? /href\s*=\s*["']([^"']+)["']/i.exec(pick)?.[1] : null;
  return href ? decode(href) : null;
}

function isoDate(raw: string | null): string | null {
  if (!raw) return null;
  const time = Date.parse(plainText(raw));
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function httpsUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(plainText(raw));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function excerptOf(raw: string | null): string {
  if (!raw) return '';
  const text = plainText(raw);
  if (text.length <= EXCERPT_MAX) return text;
  const cut = text.slice(0, EXCERPT_MAX - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > EXCERPT_MAX * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Parses RSS <item> or Atom <entry> blocks. Entries without a title and a link are dropped. */
export function parseFeed(xml: string): FeedEntry[] {
  const atom = /<feed\b[^>]*xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2005\/Atom["']/i.test(xml) || (!/<item\b/i.test(xml) && /<entry\b/i.test(xml));
  const blocks = [...xml.matchAll(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
  const entries: FeedEntry[] = [];
  for (const block of blocks.slice(0, 200)) {
    const title = plainText(tag(block, ['title']) ?? '');
    const url = atom ? httpsUrl(atomLink(block)) : httpsUrl(tag(block, ['link']) ?? tag(block, ['guid']));
    if (!title || !url) continue;
    const publishedAt = isoDate(tag(block, atom ? ['published', 'updated'] : ['pubDate', 'dc:date', 'published', 'updated']));
    const excerpt = excerptOf(tag(block, atom ? ['summary', 'content'] : ['description', 'content:encoded', 'summary']));
    entries.push({ title: title.slice(0, 300), url, publishedAt, excerpt });
  }
  return entries;
}
