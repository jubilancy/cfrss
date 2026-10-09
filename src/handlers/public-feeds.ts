import type { Context } from 'hono';
import type { Env } from '../types';
import {
  getFolderBySlug,
  getTagBySlug,
  listFolderArticles,
  listTagArticles,
  type CollectionArticle,
} from '../services/collections';
import { renderJsonFeed, renderRss, type PublicFeed } from '../services/public-feeds';
import { isReservedSlug } from '../utils/slug';

type Ctx = Context<{ Bindings: Env }>;
type Format = 'xml' | 'json';

const FEED_ITEMS = 50;

const NOT_FOUND = () =>
  new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function respond(feed: PublicFeed, format: Format): Response {
  const body = format === 'xml' ? renderRss(feed) : renderJsonFeed(feed);
  return new Response(body, {
    headers: {
      'Content-Type': format === 'xml' ? 'application/rss+xml; charset=utf-8' : 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function build(
  c: Ctx,
  format: Format,
  name: string,
  describe: string,
  pagePath: string,
  items: CollectionArticle[]
): Response {
  const origin = new URL(c.req.url).origin;
  return respond(
    {
      title: name,
      description: describe,
      homeUrl: `${origin}${pagePath}`,
      selfUrl: `${origin}${pagePath}/feed.${format === 'xml' ? 'xml' : 'json'}`,
      iconUrl: `${origin}/icons/icon-256x256.png`,
      faviconUrl: `${origin}/icons/icon-96x96.png`,
      items,
    },
    format
  );
}

/**
 * GET /tag/:slug/feed.xml and /tag/:slug/feed.json
 * Public only when the tag has been switched on. Anything else is a plain 404
 * so a private tag cannot be told apart from one that does not exist.
 */
export function handleTagFeed(format: Format) {
  return async (c: Ctx) => {
    const slug = safeDecode(c.req.param('slug')!);
    const tag = await getTagBySlug(c.env.DB, slug);
    if (!tag || !tag.isPublic) return NOT_FOUND();
    const items = await listTagArticles(c.env.DB, tag.id, FEED_ITEMS, 0);
    return build(c, format, tag.name, `Articles tagged ${tag.name}`, `/tag/${encodeURIComponent(tag.slug)}`, items);
  };
}

/** GET /:folder/feed.xml and /:folder/feed.json */
export function handleFolderFeed(format: Format) {
  return async (c: Ctx) => {
    const slug = safeDecode(c.req.param('slug')!);
    if (isReservedSlug(slug)) return NOT_FOUND();
    const folder = await getFolderBySlug(c.env.DB, slug);
    if (!folder || !folder.isPublic) return NOT_FOUND();
    const items = await listFolderArticles(c.env.DB, folder.id, FEED_ITEMS, 0);
    return build(c, format, folder.name, `Articles in ${folder.name}`, `/${encodeURIComponent(folder.slug)}`, items);
  };
}
