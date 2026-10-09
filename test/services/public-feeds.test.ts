import { describe, it, expect } from 'vitest';
import { escapeXml, renderJsonFeed, renderRss, toExcerpt, type PublicFeed } from '../../src/services/public-feeds';

const item = (over: Partial<PublicFeed['items'][number]> = {}) => ({
  id: 'a1',
  subscriptionId: 's1',
  title: 'Soup & stew <fast>',
  author: 'Jane',
  publishedAt: '2026-09-01T10:00:00.000Z',
  summary: '<p>Hello <b>world</b> &amp; friends</p>',
  sourceUrl: 'https://example.com/post?a=1&b=2',
  isRead: false,
  addedAt: '2026-09-02 10:00:00',
  ...over,
});

const feed = (items = [item()]): PublicFeed => ({
  title: 'Cooking',
  description: 'Articles tagged Cooking',
  homeUrl: 'https://rss.example/tag/Cooking',
  selfUrl: 'https://rss.example/tag/Cooking/feed.xml',
  iconUrl: 'https://rss.example/icons/icon-512x512.png',
  faviconUrl: 'https://rss.example/icons/icon-96x96.png',
  items,
});

describe('toExcerpt', () => {
  it('strips tags and decodes common entities', () => {
    expect(toExcerpt('<p>Hello <b>world</b> &amp; friends &#33;</p>')).toBe('Hello world & friends !');
  });

  it('drops script and style blocks', () => {
    expect(toExcerpt('<style>p{}</style>Hi<script>alert(1)</script>')).toBe('Hi');
  });

  it('truncates long text with an ellipsis', () => {
    const out = toExcerpt('word '.repeat(200), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('escapeXml', () => {
  it('escapes special characters and removes invalid ones', () => {
    expect(escapeXml('a & b < c > "d" \'e\'\u0001')).toBe('a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');
  });
});

describe('renderRss', () => {
  it('produces escaped, well-formed items with the original link', () => {
    const xml = renderRss(feed());
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>Soup &amp; stew &lt;fast&gt;</title>');
    expect(xml).toContain('<link>https://example.com/post?a=1&amp;b=2</link>');
    expect(xml).toContain('<pubDate>Tue, 01 Sep 2026 10:00:00 GMT</pubDate>');
    expect(xml).toContain('<description>Hello world &amp; friends</description>');
    expect(xml).toContain('rel="self"');
  });

  it('carries the channel image so readers show the icon', () => {
    const xml = renderRss(feed());
    expect(xml).toContain('<image>');
    expect(xml).toContain('<url>https://rss.example/icons/icon-512x512.png</url>');
  });

  it('never includes full article content', () => {
    const xml = renderRss(feed([item({ summary: 'x'.repeat(2000) })]));
    expect(xml.length).toBeLessThan(2000);
  });

  it('handles an empty feed', () => {
    const xml = renderRss(feed([]));
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<item>');
  });
});

describe('renderJsonFeed', () => {
  it('follows JSON Feed 1.1', () => {
    const json = JSON.parse(renderJsonFeed(feed()));
    expect(json.version).toBe('https://jsonfeed.org/version/1.1');
    expect(json.icon).toBe('https://rss.example/icons/icon-512x512.png');
    expect(json.favicon).toBe('https://rss.example/icons/icon-96x96.png');
    expect(json.feed_url).toBe('https://rss.example/tag/Cooking/feed.xml'.replace('.xml', '.xml'));
    expect(json.items[0]).toMatchObject({
      id: 'https://example.com/post?a=1&b=2',
      title: 'Soup & stew <fast>',
      summary: 'Hello world & friends',
      date_published: '2026-09-01T10:00:00.000Z',
      authors: [{ name: 'Jane' }],
    });
  });
});
