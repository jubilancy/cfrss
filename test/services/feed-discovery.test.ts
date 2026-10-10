import { describe, it, expect } from 'vitest';
import {
  discoverFeeds,
  extractFeedLinks,
  extractFeedTitle,
  isPrivateHost,
  knownFeedUrls,
  looksLikeFeed,
  normalizeInput,
} from '../../src/services/feed-discovery';

const urls = (input: string) => knownFeedUrls(new URL(input)).map((k) => k.url);

describe('normalizeInput', () => {
  it('adds https and expands r/name', () => {
    expect(normalizeInput('example.com')?.href).toBe('https://example.com/');
    expect(normalizeInput('r/rust')?.href).toBe('https://www.reddit.com/r/rust');
    expect(normalizeInput('  https://a.org/x  ')?.href).toBe('https://a.org/x');
  });

  it('rejects text that is not an address', () => {
    expect(normalizeInput('')).toBeNull();
    expect(normalizeInput('two words')).toBeNull();
    expect(normalizeInput('nodots')).toBeNull();
  });
});

describe('isPrivateHost', () => {
  it('blocks local and private addresses', () => {
    for (const h of ['localhost', '127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.0.1', 'x.internal', 'nas.local', '[::1]']) {
      expect(isPrivateHost(h), h).toBe(true);
    }
  });

  it('allows public hosts', () => {
    expect(isPrivateHost('example.com')).toBe(false);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
  });
});

describe('looksLikeFeed and extractFeedTitle', () => {
  it('recognises RSS, Atom and RDF but not HTML', () => {
    expect(looksLikeFeed('<?xml version="1.0"?><rss version="2.0"><channel>')).toBe(true);
    expect(looksLikeFeed('<feed xmlns="http://www.w3.org/2005/Atom">')).toBe(true);
    expect(looksLikeFeed('<rdf:RDF xmlns:rdf="x">')).toBe(true);
    expect(looksLikeFeed('<!doctype html><html><head><title>Hi</title>')).toBe(false);
  });

  it('reads CDATA and entities, and ignores the channel image title', () => {
    const rss = `<rss><channel><image><title>Logo</title></image><title><![CDATA[Tom &amp; Jerry]]></title><item><title>Post</title></item></channel></rss>`;
    expect(extractFeedTitle(rss)).toBe('Tom & Jerry');
    expect(extractFeedTitle('<feed><title>My blog</title><entry><title>One</title></entry></feed>')).toBe('My blog');
    expect(extractFeedTitle('<rss><channel></channel></rss>')).toBe('Untitled feed');
  });
});

describe('extractFeedLinks', () => {
  it('finds alternate feed links in any attribute order and resolves them', () => {
    const html = `<head>
      <link rel="stylesheet" href="/a.css">
      <link href="/feed.xml" type="application/rss+xml" rel="alternate" title="Posts">
      <link rel='alternate' type='application/atom+xml' href='https://other.example/atom'>
      <link rel="alternate" type="text/html" href="/fr">
    </head>`;
    expect(extractFeedLinks(html, 'https://site.example/blog/')).toEqual([
      { url: 'https://site.example/feed.xml', title: 'Posts' },
      { url: 'https://other.example/atom', title: '' },
    ]);
  });
});

describe('knownFeedUrls', () => {
  it('YouTube channels and playlists', () => {
    expect(urls('https://www.youtube.com/channel/UCabc_123')).toEqual([
      'https://www.youtube.com/feeds/videos.xml?channel_id=UCabc_123',
    ]);
    expect(urls('https://www.youtube.com/playlist?list=PL42')).toEqual([
      'https://www.youtube.com/feeds/videos.xml?playlist_id=PL42',
    ]);
  });

  it('Reddit subreddits and users', () => {
    expect(urls('https://www.reddit.com/r/rust/')).toEqual(['https://www.reddit.com/r/rust/.rss']);
    expect(urls('https://www.reddit.com/user/spez')).toEqual(['https://www.reddit.com/user/spez/.rss']);
  });

  it('GitHub repositories and users', () => {
    expect(urls('https://github.com/cloudflare/workers-sdk')).toEqual([
      'https://github.com/cloudflare/workers-sdk/releases.atom',
      'https://github.com/cloudflare/workers-sdk/commits.atom',
      'https://github.com/cloudflare/workers-sdk/tags.atom',
    ]);
    expect(urls('https://github.com/torvalds')).toEqual(['https://github.com/torvalds.atom']);
  });

  it('Bluesky, Mastodon, Substack, Medium and Tumblr', () => {
    expect(urls('https://bsky.app/profile/alice.bsky.social')).toEqual([
      'https://bsky.app/profile/alice.bsky.social/rss',
    ]);
    expect(urls('https://mastodon.social/@gargron')).toEqual(['https://mastodon.social/@gargron.rss']);
    expect(urls('https://writer.substack.com/p/some-post')).toEqual(['https://writer.substack.com/feed']);
    expect(urls('https://medium.com/@jane')).toEqual(['https://medium.com/feed/@jane']);
    expect(urls('https://fromdaysoff.tumblr.com/')).toEqual(['https://fromdaysoff.tumblr.com/rss']);
  });

  it('returns nothing for an ordinary site', () => {
    expect(urls('https://example.com/blog')).toEqual([]);
  });
});

/** A fake network: address -> response. Anything else is a 404. */
function fakeFetch(map: Record<string, { status?: number; body?: string }>) {
  const calls: string[] = [];
  const fetcher = async (input: string): Promise<Response> => {
    calls.push(input);
    const hit = map[input];
    if (!hit) return new Response('', { status: 404 });
    return new Response(hit.body ?? '', { status: hit.status ?? 200 });
  };
  return { fetcher, calls };
}

const RSS = (title: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title></channel></rss>`;

describe('discoverFeeds', () => {
  it('returns the address itself when it already is a feed', async () => {
    const { fetcher } = fakeFetch({ 'https://a.example/feed.xml': { body: RSS('A') } });
    const result = await discoverFeeds('https://a.example/feed.xml', fetcher);
    expect(result.candidates).toEqual([
      { url: 'https://a.example/feed.xml', title: 'A', source: 'direct', verified: true },
    ]);
  });

  it('follows the feed link advertised by the page', async () => {
    const { fetcher } = fakeFetch({
      'https://b.example/': { body: '<head><link rel="alternate" type="application/rss+xml" href="/posts.xml"></head>' },
      'https://b.example/posts.xml': { body: RSS('B posts') },
    });
    const result = await discoverFeeds('b.example', fetcher);
    expect(result.candidates.map((c) => [c.url, c.title, c.source])).toEqual([
      ['https://b.example/posts.xml', 'B posts', 'page'],
    ]);
  });

  it('tries common paths when the page advertises nothing', async () => {
    const { fetcher } = fakeFetch({
      'https://c.example/': { body: '<html>no links</html>' },
      'https://c.example/rss.xml': { body: RSS('C') },
    });
    const result = await discoverFeeds('https://c.example/', fetcher);
    expect(result.candidates.map((c) => [c.url, c.source])).toEqual([['https://c.example/rss.xml', 'guess']]);
  });

  it('builds a known feed address and checks it', async () => {
    const { fetcher } = fakeFetch({
      'https://github.com/o/r': { body: '<html></html>' },
      'https://github.com/o/r/releases.atom': { body: '<feed><title>Releases</title></feed>' },
      'https://github.com/o/r/commits.atom': { body: '<feed><title>Commits</title></feed>' },
    });
    const result = await discoverFeeds('https://github.com/o/r', fetcher);
    expect(result.candidates.map((c) => c.title)).toEqual(['Releases', 'Commits']);
    expect(result.candidates.every((c) => c.verified)).toBe(true);
  });

  it('says so when the site refuses us, and still offers the known address', async () => {
    const { fetcher } = fakeFetch({
      'https://www.reddit.com/r/rust': { status: 403 },
      'https://www.reddit.com/r/rust/.rss': { status: 403 },
    });
    const result = await discoverFeeds('r/rust', fetcher);
    expect(result.candidates).toEqual([
      { url: 'https://www.reddit.com/r/rust/.rss', title: 'r/rust', source: 'known', verified: false },
    ]);
    expect(result.notes.join(' ')).toContain('403');
  });

  it('explains when nothing is found', async () => {
    const { fetcher } = fakeFetch({ 'https://d.example/': { body: '<html>plain</html>' } });
    const result = await discoverFeeds('d.example', fetcher);
    expect(result.candidates).toEqual([]);
    expect(result.notes[0]).toContain('No feed found');
  });

  it('refuses private addresses without fetching', async () => {
    const { fetcher, calls } = fakeFetch({});
    const result = await discoverFeeds('http://192.168.1.5/feed', fetcher);
    expect(result.candidates).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('handles text that is not an address', async () => {
    const { fetcher, calls } = fakeFetch({});
    const result = await discoverFeeds('hello there', fetcher);
    expect(result.candidates).toEqual([]);
    expect(calls).toEqual([]);
  });
});
