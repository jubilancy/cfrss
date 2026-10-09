/**
 * Public feeds — RSS 2.0 and JSON Feed output for a tag or folder.
 *
 * Only a title, link, date, author and a short excerpt go out. Full article
 * text is never published, since it belongs to the original sites.
 */

import type { CollectionArticle } from './collections';

export interface PublicFeed {
  title: string;
  description: string;
  /** The page the feed describes (the tag or folder page). */
  homeUrl: string;
  /** The feed's own address. */
  selfUrl: string;
  items: CollectionArticle[];
}

const EXCERPT_LENGTH = 280;

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Turn feed HTML into a short plain-text excerpt. */
export function toExcerpt(html: string, maxLength = EXCERPT_LENGTH): string {
  const text = (html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Remove characters XML 1.0 cannot carry, then escape the five special ones. */
export function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function renderRss(feed: PublicFeed): string {
  const newest = feed.items.map((i) => toDate(i.publishedAt)).find((d): d is Date => d !== null);
  const items = feed.items
    .map((item) => {
      const date = toDate(item.publishedAt);
      const lines = [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.sourceUrl)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.sourceUrl)}</guid>`,
      ];
      if (date) lines.push(`      <pubDate>${date.toUTCString()}</pubDate>`);
      if (item.author) lines.push(`      <author>${escapeXml(item.author)}</author>`);
      const excerpt = toExcerpt(item.summary);
      if (excerpt) lines.push(`      <description>${escapeXml(excerpt)}</description>`);
      lines.push('    </item>');
      return lines.join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feed.title)}</title>
    <link>${escapeXml(feed.homeUrl)}</link>
    <description>${escapeXml(feed.description)}</description>
    <atom:link href="${escapeXml(feed.selfUrl)}" rel="self" type="application/rss+xml"/>
${newest ? `    <lastBuildDate>${newest.toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
}

export function renderJsonFeed(feed: PublicFeed): string {
  return JSON.stringify(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: feed.title,
      home_page_url: feed.homeUrl,
      feed_url: feed.selfUrl,
      description: feed.description,
      items: feed.items.map((item) => {
        const date = toDate(item.publishedAt);
        const excerpt = toExcerpt(item.summary);
        return {
          id: item.sourceUrl,
          url: item.sourceUrl,
          title: item.title,
          ...(excerpt ? { summary: excerpt } : {}),
          ...(date ? { date_published: date.toISOString() } : {}),
          ...(item.author ? { authors: [{ name: item.author }] } : {}),
        };
      }),
    },
    null,
    2
  );
}
