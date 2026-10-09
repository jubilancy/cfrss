/**
 * URL slugs for tags and folders.
 *
 * Folders live at the site root (/TBR) and tags under /tag/ (/tag/cooking),
 * so a folder slug must never collide with a path the app already uses.
 * Shared between the Worker (validation) and the client router.
 */

/** Paths owned by the app. A folder cannot take any of these names. */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'api',
  'articles',
  'article',
  'bookmarks',
  'category',
  'categories',
  'css',
  'digest',
  'feed',
  'feeds',
  'folder',
  'folders',
  'icons',
  'index',
  'js',
  'library',
  'login',
  'settings',
  'subscriptions',
  'tag',
  'tags',
]);

/** True when the slug (any case) is one the app reserves. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Turn a display name into a URL slug. Keeps letters and numbers from any
 * language, turns other runs of characters into a single dash, and keeps the
 * original capitalisation (so "TBR" stays "TBR"). Returns '' when nothing
 * usable is left.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFC')
    .trim()
    .replace(/[^\p{L}\p{N}_]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
