/**
 * Simple client-side router using real URL paths (History API).
 *
 * Routes:
 *   /                              home (main view)
 *   /articles                      all articles
 *   /feed/:feedId                  articles of one subscription
 *   /category/:categoryId          articles of one category
 *   /articles/:id                  one article
 *   /feed/:feedId/articles/:id     one article, keeping the feed filter
 *   /category/:categoryId/articles/:id
 *   /bookmarks  /digest  /subscriptions  /settings
 *
 * Old `#/...` links are rewritten to the matching path on load, so existing
 * bookmarks keep working. Names such as `feed`, `category` and `tag` are
 * reserved for the app and cannot be used as folder names later.
 */

export interface Route {
  path: string;
  params: Record<string, string>;
  /**
   * Filter and query values. Path routes fill these in too, e.g. `/feed/x`
   * gives `{ subscription: 'x' }`, so components read one shape.
   */
  query: Record<string, string>;
}

export type RouteChangeHandler = (route: Route) => void;

/** The list filter shared by the tree, the article list and article links. */
export interface RouteFilter {
  feedId: string | null;
  categoryId: string | null;
}

interface RouteDef {
  pattern: RegExp;
  name: string;
  /** Turn the regex match into params and filter query values. */
  build: (match: RegExpMatchArray) => { params?: Record<string, string>; query?: Record<string, string> };
}

const ROUTES: RouteDef[] = [
  {
    pattern: /^\/feed\/([^/]+)\/articles\/(.+)$/,
    name: 'article-detail',
    build: (m) => ({ params: { id: m[2] }, query: { subscription: m[1] } }),
  },
  {
    pattern: /^\/category\/([^/]+)\/articles\/(.+)$/,
    name: 'article-detail',
    build: (m) => ({ params: { id: m[2] }, query: { category: m[1] } }),
  },
  { pattern: /^\/articles\/(.+)$/, name: 'article-detail', build: (m) => ({ params: { id: m[1] } }) },
  { pattern: /^\/articles\/?$/, name: 'articles', build: () => ({}) },
  { pattern: /^\/feed\/([^/]+)\/?$/, name: 'articles', build: (m) => ({ query: { subscription: m[1] } }) },
  { pattern: /^\/category\/([^/]+)\/?$/, name: 'articles', build: (m) => ({ query: { category: m[1] } }) },
  { pattern: /^\/bookmarks\/?$/, name: 'bookmarks', build: () => ({}) },
  { pattern: /^\/digest\/?$/, name: 'digest', build: () => ({}) },
  { pattern: /^\/subscriptions\/?$/, name: 'subscriptions', build: () => ({}) },
  { pattern: /^\/settings\/?$/, name: 'settings', build: () => ({}) },
  { pattern: /^\/?$/, name: 'home', build: () => ({}) },
];

function parseQuery(raw: string | undefined): Record<string, string> {
  const query: Record<string, string> = {};
  if (!raw) return query;
  for (const pair of raw.split('&')) {
    const [key, value] = pair.split('=');
    if (key) query[decodeURIComponent(key)] = decodeURIComponent(value ?? '');
  }
  return query;
}

let currentRoute: Route = { path: 'home', params: {}, query: {} };
let listeners: RouteChangeHandler[] = [];

/** Match a pathname against the app's routes. Null when it is not an app route. */
function matchRoute(pathname: string): { name: string; params: Record<string, string>; query: Record<string, string> } | null {
  for (const route of ROUTES) {
    const match = pathname.match(route.pattern);
    if (match) {
      const built = route.build(match);
      return { name: route.name, params: built.params ?? {}, query: built.query ?? {} };
    }
  }
  return null;
}

/**
 * Parse a path (with an optional `?query`) into a Route.
 * Unknown paths fall back to home.
 */
export function parsePath(pathWithQuery: string): Route {
  const [pathname, rawQuery] = (pathWithQuery || '/').split('?');
  const queryFromUrl = parseQuery(rawQuery);
  const matched = matchRoute(pathname || '/');
  if (!matched) {
    return { path: 'home', params: {}, query: queryFromUrl };
  }
  return { path: matched.name, params: matched.params, query: { ...queryFromUrl, ...matched.query } };
}

/**
 * Parse an old-style hash (`#/articles/x`). Kept so legacy links and tests
 * still resolve to the same routes.
 */
export function parseHash(hash: string): Route {
  const stripped = (hash || '').replace(/^#/, '');
  return parsePath(stripped || '/');
}

/** Path of the article list for a filter. */
export function listPath(filter: RouteFilter): string {
  if (filter.feedId) return `/feed/${filter.feedId}`;
  if (filter.categoryId) return `/category/${filter.categoryId}`;
  return '/articles';
}

/** Path of one article, keeping the list filter in the URL. */
export function articlePath(id: string, filter?: RouteFilter): string {
  if (filter?.feedId) return `/feed/${filter.feedId}/articles/${id}`;
  if (filter?.categoryId) return `/category/${filter.categoryId}/articles/${id}`;
  return `/articles/${id}`;
}

function currentPathWithQuery(): string {
  return window.location.pathname + window.location.search;
}

function notify(): void {
  const newRoute = parsePath(currentPathWithQuery());
  currentRoute = newRoute;
  listeners.forEach((handler) => handler(newRoute));
}

/**
 * Navigate to a new route. Accepts `/articles/x`; a leading `#` is ignored
 * so older callers keep working.
 */
export function navigate(path: string): void {
  let target = path.startsWith('#') ? path.slice(1) : path;
  if (!target.startsWith('/')) target = `/${target}`;
  if (target === currentPathWithQuery()) return;
  window.history.pushState(null, '', target);
  notify();
}

/**
 * Get the current route.
 */
export function getCurrentRoute(): Route {
  return currentRoute;
}

/**
 * Subscribe to route changes.
 */
export function onRouteChange(handler: RouteChangeHandler): () => void {
  listeners.push(handler);
  return () => {
    listeners = listeners.filter((l) => l !== handler);
  };
}

/**
 * Turn clicks on in-app links into history navigation, without a page load.
 * External links, new-tab clicks and non-app paths are left alone.
 */
function handleLinkClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target as Element | null;
  const anchor = target?.closest?.('a');
  if (!anchor || anchor.hasAttribute('download')) return;
  const targetAttr = anchor.getAttribute('target');
  if (targetAttr && targetAttr !== '_self') return;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return;
  if (!matchRoute(url.pathname)) return;
  event.preventDefault();
  navigate(url.pathname + url.search);
}

function handlePopState(): void {
  notify();
}

/**
 * Initialize the router — call once on app startup.
 */
export function initRouter(): Route {
  // Old bookmarks look like /#/articles/x — rewrite to /articles/x.
  const legacy = window.location.hash;
  if (legacy.startsWith('#/')) {
    window.history.replaceState(null, '', legacy.slice(1));
  }
  window.addEventListener('popstate', handlePopState);
  document.addEventListener('click', handleLinkClick);
  currentRoute = parsePath(currentPathWithQuery());
  return currentRoute;
}

/**
 * Destroy the router (cleanup).
 */
export function destroyRouter(): void {
  window.removeEventListener('popstate', handlePopState);
  document.removeEventListener('click', handleLinkClick);
  listeners = [];
}
