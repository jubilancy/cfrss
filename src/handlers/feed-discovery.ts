import type { Context } from 'hono';
import type { Env } from '../types';
import { discoverFeeds } from '../services/feed-discovery';
import { validationError } from '../utils/errors';

/**
 * POST /api/feeds/discover — { url: string }
 *
 * Finds feeds for a website, channel or profile address. Always answers 200
 * with `{ candidates, notes }`; an empty list plus notes explains why.
 */
export async function handleDiscoverFeeds(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ url?: unknown }>().catch(() => ({}) as { url?: unknown });
  if (typeof body.url !== 'string' || body.url.trim() === '') {
    throw validationError('url is required and must be a string');
  }
  if (body.url.length > 2048) {
    throw validationError('url must not exceed 2048 characters');
  }
  return c.json(await discoverFeeds(body.url));
}
