import type { Context } from 'hono';
import type { Env } from '../types';
import {
  addArticleToFolder,
  addTagToArticle,
  createFolder,
  deleteFolder,
  deleteTag,
  getFolderBySlug,
  getTagBySlug,
  listArticleFolders,
  listArticleTags,
  listFolderArticles,
  listFolders,
  listTagArticles,
  listTags,
  removeArticleFromFolder,
  removeTagFromArticle,
  renameFolder,
} from '../services/collections';
import { notFoundError, validationError } from '../utils/errors';
import { parsePageLimit } from '../middleware/cpu-monitor';

type Ctx = Context<{ Bindings: Env }>;

function pageParams(c: Ctx): { limit: number; offset: number } {
  return {
    limit: parsePageLimit(c.req.query('limit')),
    offset: Math.max(0, parseInt(c.req.query('offset') || '0', 10) || 0),
  };
}

async function readName(c: Ctx): Promise<string> {
  const body = await c.req.json<{ name?: unknown }>().catch(() => ({}) as { name?: unknown });
  if (!body.name || typeof body.name !== 'string') {
    throw validationError('Missing or invalid "name" field. Must be a non-empty string.');
  }
  return body.name;
}

// ---- Tags ----

/** GET /api/tags — all tags with how many articles each has. */
export async function handleListTags(c: Ctx) {
  return c.json({ tags: await listTags(c.env.DB) });
}

/** GET /api/tags/:slug/articles — articles carrying a tag (slug is case-insensitive). */
export async function handleListTagArticles(c: Ctx) {
  const tag = await getTagBySlug(c.env.DB, c.req.param('slug')!);
  if (!tag) throw notFoundError(`Tag not found: ${c.req.param('slug')}`);
  const { limit, offset } = pageParams(c);
  const articles = await listTagArticles(c.env.DB, tag.id, limit, offset);
  return c.json({ tag, articles, limit, offset });
}

/** DELETE /api/tags/:id — delete a tag everywhere. Articles are kept. */
export async function handleDeleteTag(c: Ctx) {
  const removed = await deleteTag(c.env.DB, c.req.param('id')!);
  if (!removed) throw notFoundError(`Tag not found: ${c.req.param('id')}`);
  return c.json({ success: true });
}

// ---- Folders ----

/** GET /api/folders — all folders with article counts. */
export async function handleListFolders(c: Ctx) {
  return c.json({ folders: await listFolders(c.env.DB) });
}

/** POST /api/folders — { name }. Returns 201. */
export async function handleCreateFolder(c: Ctx) {
  const folder = await createFolder(c.env.DB, await readName(c));
  return c.json({ folder }, 201);
}

/** PUT /api/folders/:id — rename. */
export async function handleRenameFolder(c: Ctx) {
  const folder = await renameFolder(c.env.DB, c.req.param('id')!, await readName(c));
  return c.json({ folder });
}

/** DELETE /api/folders/:id — delete a folder. Articles are kept. */
export async function handleDeleteFolder(c: Ctx) {
  const removed = await deleteFolder(c.env.DB, c.req.param('id')!);
  if (!removed) throw notFoundError(`Folder not found: ${c.req.param('id')}`);
  return c.json({ success: true });
}

/** GET /api/folders/:slug/articles — articles in a folder (slug is case-insensitive). */
export async function handleListFolderArticles(c: Ctx) {
  const folder = await getFolderBySlug(c.env.DB, c.req.param('slug')!);
  if (!folder) throw notFoundError(`Folder not found: ${c.req.param('slug')}`);
  const { limit, offset } = pageParams(c);
  const articles = await listFolderArticles(c.env.DB, folder.id, limit, offset);
  return c.json({ folder, articles, limit, offset });
}

/** PUT /api/folders/:id/articles/:articleId — add an article. Idempotent. */
export async function handleAddArticleToFolder(c: Ctx) {
  await addArticleToFolder(c.env.DB, c.req.param('id')!, c.req.param('articleId')!);
  return c.json({ success: true });
}

/** DELETE /api/folders/:id/articles/:articleId — take an article out. */
export async function handleRemoveArticleFromFolder(c: Ctx) {
  const removed = await removeArticleFromFolder(c.env.DB, c.req.param('id')!, c.req.param('articleId')!);
  if (!removed) throw notFoundError('That article is not in this folder');
  return c.json({ success: true });
}

// ---- Per-article ----

/** GET /api/articles/:id/organize — the tags and folders one article is in. */
export async function handleGetArticleOrganization(c: Ctx) {
  const articleId = c.req.param('id')!;
  const [tags, folders] = await Promise.all([
    listArticleTags(c.env.DB, articleId),
    listArticleFolders(c.env.DB, articleId),
  ]);
  return c.json({ tags, folders });
}

/** POST /api/articles/:id/tags — { name }. Creates the tag if it is new. */
export async function handleAddArticleTag(c: Ctx) {
  const tag = await addTagToArticle(c.env.DB, c.req.param('id')!, await readName(c));
  return c.json({ tag }, 201);
}

/** DELETE /api/articles/:id/tags/:tagId — take a tag off an article. */
export async function handleRemoveArticleTag(c: Ctx) {
  const removed = await removeTagFromArticle(c.env.DB, c.req.param('id')!, c.req.param('tagId')!);
  if (!removed) throw notFoundError('That article does not have this tag');
  return c.json({ success: true });
}
