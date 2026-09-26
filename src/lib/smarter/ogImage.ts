/**
 * The picture a publisher picked for its own story: the og:image (or
 * twitter:image) link previews show. Only absolute https images count, so
 * nothing loads insecurely or from our own origin.
 */
export function ogImageFrom(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 200_000);
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (key !== 'og:image' && key !== 'og:image:secure_url' && key !== 'twitter:image' && key !== 'twitter:image:src') continue;
    const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim();
    if (!content) continue;
    try {
      const url = new URL(content.replace(/&amp;/g, '&'), pageUrl);
      if (url.protocol === 'https:' && !/\.svg(?:$|\?)/i.test(url.pathname) && !/(?:logo|favicon|placeholder|default-share|avatar)/i.test(url.pathname)) return url.toString();
    } catch {
      // not a URL; try the next tag
    }
  }
  return null;
}
