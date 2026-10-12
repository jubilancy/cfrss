/**
 * Feed discovery — turn "any website, channel or profile address" into feeds.
 *
 * Steps, in order:
 *   1. If the address already is a feed, return it.
 *   2. Read the page's own `<link rel="alternate">` feed links.
 *   3. Apply known address patterns (YouTube, Reddit, GitHub, Mastodon,
 *      Bluesky, Substack, Medium, Tumblr).
 *   4. If still nothing, try the common feed paths (/feed, /rss.xml, ...).
 * Every candidate is fetched and checked, so a result marked `verified` really
 * is a feed. When a site refuses us, we say so instead of failing silently.
 *
 * The pure helpers are exported so they can be tested without a network.
 */

export interface FeedCandidate {
  url: string;
  title: string;
  /** Where the candidate came from, for display. */
  source: 'direct' | 'page' | 'known' | 'guess';
  /** True when we fetched it and it parsed as a feed. */
  verified: boolean;
}

export interface DiscoveryResult {
  candidates: FeedCandidate[];
  /** Plain-language notes, e.g. that a site refused the request. */
  notes: string[];
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const USER_AGENT = 'Mozilla/5.0 (compatible; CFRSS-Reader feed finder)';
const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 600_000;
const MAX_VERIFY = 8;
const COMMON_PATHS = ['/feed', '/feed/', '/rss', '/rss.xml', '/atom.xml', '/feed.xml', '/index.xml'];

// ---------------------------------------------------------------- pure ----

/** Add https:// when missing and expand "r/name" to a Reddit address. */
export function normalizeInput(raw: string): URL | null {
  let text = (raw ?? '').trim();
  if (!text || /\s/.test(text)) return null;
  if (/^r\/[A-Za-z0-9_]+\/?$/.test(text)) text = `https://www.reddit.com/${text}`;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    return url.hostname.includes('.') ? url : null;
  } catch {
    return null;
  }
}

/** Addresses we must never fetch: this machine, private networks, internal names. */
export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.startsWith('[') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)
  );
}

function strip(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** True when the text is an RSS, Atom or RDF feed. */
export function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 3000);
  return /<(rss|feed|rdf:RDF)[\s>]/i.test(head);
}

/** Feed title: the first <title> before the first entry, CDATA and entities handled. */
export function extractFeedTitle(text: string): string {
  const cut = text.search(/<(item|entry)[\s>]/i);
  const header = cut === -1 ? text.slice(0, 6000) : text.slice(0, cut);
  const withoutImage = header.replace(/<image[\s>][\s\S]*?<\/image>/gi, '');
  const match = withoutImage.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? decodeEntities(strip(match[1])).replace(/\s+/g, ' ').trim() : '';
  return title || 'Untitled feed';
}

/** Feed links advertised by an HTML page, resolved against the page address. */
export function extractFeedLinks(html: string, base: string): Array<{ url: string; title: string }> {
  const found: Array<{ url: string; title: string }> = [];
  const tags = html.slice(0, MAX_BODY_BYTES).match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attr = (name: string): string => {
      const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
      return m ? decodeEntities(m[2] ?? m[3] ?? m[4] ?? '') : '';
    };
    if (!/\balternate\b/i.test(attr('rel'))) continue;
    if (!/(rss|atom)\+xml|application\/xml|text\/xml/i.test(attr('type'))) continue;
    const href = attr('href');
    if (!href) continue;
    try {
      found.push({ url: new URL(href, base).href, title: attr('title') });
    } catch {
      // skip a link we cannot resolve
    }
  }
  return found;
}

/** Addresses we know how to turn into a feed without reading the page. */
export function knownFeedUrls(url: URL): Array<{ url: string; title: string }> {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname.replace(/\/+$/, '');
  const out: Array<{ url: string; title: string }> = [];

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const channel = path.match(/^\/channel\/([\w-]+)$/);
    if (channel) out.push({ url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channel[1]}`, title: 'YouTube channel' });
    const list = url.searchParams.get('list');
    if (list) out.push({ url: `https://www.youtube.com/feeds/videos.xml?playlist_id=${list}`, title: 'YouTube playlist' });
  }

  if (host === 'reddit.com' || host === 'old.reddit.com') {
    const sub = path.match(/^\/r\/([A-Za-z0-9_]+)(\/.*)?$/);
    if (sub) out.push({ url: `https://www.reddit.com/r/${sub[1]}/.rss`, title: `r/${sub[1]}` });
    const user = path.match(/^\/(?:u|user)\/([A-Za-z0-9_-]+)/);
    if (user) out.push({ url: `https://www.reddit.com/user/${user[1]}/.rss`, title: `u/${user[1]}` });
  }

  if (host === 'github.com') {
    const repo = path.match(/^\/([\w.-]+)\/([\w.-]+)$/);
    if (repo) {
      const base = `https://github.com/${repo[1]}/${repo[2]}`;
      out.push({ url: `${base}/releases.atom`, title: `${repo[2]} releases` });
      out.push({ url: `${base}/commits.atom`, title: `${repo[2]} commits` });
      out.push({ url: `${base}/tags.atom`, title: `${repo[2]} tags` });
    } else {
      const user = path.match(/^\/([\w.-]+)$/);
      if (user) out.push({ url: `https://github.com/${user[1]}.atom`, title: `${user[1]} activity` });
    }
  }

  if (host === 'bsky.app') {
    const profile = path.match(/^\/profile\/([\w.:-]+)$/);
    if (profile) out.push({ url: `https://bsky.app/profile/${profile[1]}/rss`, title: `${profile[1]} on Bluesky` });
  }

  // Mastodon-style profile: https://instance/@name
  const mastodon = path.match(/^\/@([\w.-]+)$/);
  if (mastodon && host !== 'medium.com') {
    out.push({ url: `${url.origin}/@${mastodon[1]}.rss`, title: `@${mastodon[1]}` });
  }

  if (host === 'medium.com') {
    const handle = path.match(/^\/(@[\w.-]+)$/);
    if (handle) out.push({ url: `https://medium.com/feed/${handle[1]}`, title: `${handle[1]} on Medium` });
    const pub = path.match(/^\/([\w-]+)$/);
    if (!handle && pub) out.push({ url: `https://medium.com/feed/${pub[1]}`, title: `${pub[1]} on Medium` });
  }

  if (host.endsWith('.substack.com')) {
    out.push({ url: `${url.origin}/feed`, title: 'Substack' });
  }

  if (host.endsWith('.tumblr.com')) {
    out.push({ url: `${url.origin}/rss`, title: 'Tumblr' });
  }

  return out;
}

/** Plain-language reason for a refused or failed fetch. */
export function describeStatus(status: number): string {
  if (status === 401 || status === 403) {
    return `The site refused the request (${status}). It may block feed readers hosted on Cloudflare.`;
  }
  if (status === 404) return 'The page was not found (404).';
  if (status === 429) return 'The site says we asked too often (429). Try again later.';
  if (status >= 500) return `The site had a problem (${status}). Try again later.`;
  return `The site answered with status ${status}.`;
}

// ------------------------------------------------------------- network ----

async function readCapped(response: Response): Promise<string> {
  if (!response.body) return (await response.text()).slice(0, MAX_BODY_BYTES);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let size = 0;
  while (size < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  void reader.cancel().catch(() => undefined);
  return text;
}

interface Fetched {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string;
  text: string;
  error?: string;
}

async function get(fetcher: Fetcher, url: string): Promise<Fetched> {
  try {
    const response = await fetcher(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.5',
      },
    });
    const finalUrl = response.url || url;
    if (!response.ok) {
      return { ok: false, status: response.status, finalUrl, contentType: '', text: '' };
    }
    return {
      ok: true,
      status: response.status,
      finalUrl,
      contentType: response.headers.get('Content-Type') ?? '',
      text: await readCapped(response),
    };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      contentType: '',
      text: '',
      error: timedOut ? 'The site took too long to answer.' : 'Could not reach the site.',
    };
  }
}

/** Fetch each candidate address and keep what is really a feed. */
async function verify(
  fetcher: Fetcher,
  items: Array<{ url: string; title: string; source: FeedCandidate['source'] }>,
  notes: string[]
): Promise<FeedCandidate[]> {
  const unique = [...new Map(items.map((i) => [i.url, i])).values()].slice(0, MAX_VERIFY);
  const checked = await Promise.all(
    unique.map(async (item): Promise<FeedCandidate | null> => {
      if (isPrivateHost(new URL(item.url).hostname)) return null;
      const res = await get(fetcher, item.url);
      if (res.ok && looksLikeFeed(res.text)) {
        const title = extractFeedTitle(res.text);
        return { url: res.finalUrl || item.url, title: title === 'Untitled feed' ? item.title || title : title, source: item.source, verified: true };
      }
      if (!res.ok && item.source === 'known') {
        const why = res.error ?? describeStatus(res.status);
        if (!notes.includes(why)) notes.push(why);
        return { url: item.url, title: item.title, source: item.source, verified: false };
      }
      return null;
    })
  );
  return checked.filter((c): c is FeedCandidate => c !== null);
}

/** Find feeds for any address. Never throws; problems come back as notes. */
export async function discoverFeeds(rawInput: string, fetcher: Fetcher = fetch): Promise<DiscoveryResult> {
  const notes: string[] = [];
  const input = normalizeInput(rawInput);
  if (!input) {
    return { candidates: [], notes: ['That does not look like a web address. Try something like example.com.'] };
  }
  if (isPrivateHost(input.hostname)) {
    return { candidates: [], notes: ['That address points at a private network, so it cannot be a public feed.'] };
  }

  // 1. The page itself.
  const page = await get(fetcher, input.href);
  if (page.ok && looksLikeFeed(page.text)) {
    return {
      candidates: [{ url: page.finalUrl || input.href, title: extractFeedTitle(page.text), source: 'direct', verified: true }],
      notes,
    };
  }
  if (!page.ok) {
    notes.push(page.error ?? describeStatus(page.status));
  }

  const queue: Array<{ url: string; title: string; source: FeedCandidate['source'] }> = [];

  // 2. Feed links advertised by the page.
  if (page.ok) {
    for (const link of extractFeedLinks(page.text, page.finalUrl || input.href)) {
      queue.push({ ...link, source: 'page' });
    }
  }

  // 3. Known address patterns.
  const sources = [input];
  if (page.finalUrl && page.finalUrl !== input.href) {
    try {
      sources.push(new URL(page.finalUrl));
    } catch {
      // keep the original only
    }
  }
  for (const source of sources) {
    for (const known of knownFeedUrls(source)) queue.push({ ...known, source: 'known' });
  }

  let candidates = await verify(fetcher, queue, notes);

  // 4. Common paths, only when nothing has been found yet.
  if (candidates.every((c) => !c.verified) && page.ok) {
    const origin = new URL(page.finalUrl || input.href).origin;
    const guesses = COMMON_PATHS.map((p) => ({ url: `${origin}${p}`, title: '', source: 'guess' as const }));
    const guessed = await verify(fetcher, guesses, []);
    candidates = [...candidates.filter((c) => c.verified || c.source === 'known'), ...guessed];
  }

  const verified = candidates.filter((c) => c.verified);
  if (verified.length > 0) {
    // A refused address is only useful when nothing better exists.
    candidates = verified;
    notes.length = 0;
  } else if (candidates.length === 0 && page.ok) {
    notes.push('No feed found on that page. The site may not publish one.');
  }

  return { candidates, notes };
}
