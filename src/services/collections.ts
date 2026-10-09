/**
 * Tags and folders — per-article organisation.
 *
 * Tags are stackable labels, folders are hand-curated lists. Both are
 * addressed by a case-insensitive URL slug. Same shape as bookmarks.ts:
 * plain functions taking a `D1Database` first.
 */

import { conflictError, notFoundError, validationError } from '../utils/errors';
import { isReservedSlug, slugify } from '../utils/slug';

export interface Tag {
  id: string;
  slug: string;
  name: string;
  count: number;
  /** Whether the tag publishes a public RSS and JSON feed. */
  isPublic: boolean;
}

export interface Folder {
  id: string;
  slug: string;
  name: string;
  order: number;
  count: number;
  /** Whether the folder publishes a public RSS and JSON feed. */
  isPublic: boolean;
}

/** Article card metadata, the same shape the bookmarks list uses. */
export interface CollectionArticle {
  id: string;
  subscriptionId: string;
  title: string;
  author: string;
  publishedAt: string;
  summary: string;
  sourceUrl: string;
  isRead: boolean;
  addedAt: string;
}

interface ArticleRow {
  id: string;
  subscription_id: string;
  title: string;
  author: string | null;
  published_at: string;
  summary: string | null;
  source_url: string;
  is_read: number | null;
  added_at: string;
}

const MAX_NAME_LENGTH = 50;

function rowToArticle(row: ArticleRow): CollectionArticle {
  return {
    id: row.id,
    subscriptionId: row.subscription_id,
    title: row.title,
    author: row.author ?? '',
    publishedAt: row.published_at,
    summary: row.summary ?? '',
    sourceUrl: row.source_url,
    isRead: (row.is_read ?? 0) === 1,
    addedAt: row.added_at,
  };
}

/** Collapse whitespace and check length. Returns the cleaned name. */
function cleanName(raw: unknown, what: string): string {
  if (typeof raw !== 'string') {
    throw validationError(`${what} name is required`);
  }
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    throw validationError(`${what} name must be 1-${MAX_NAME_LENGTH} characters`);
  }
  return name;
}

async function articleExists(db: D1Database, articleId: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 AS hit FROM articles WHERE id = ?').bind(articleId).first();
  return row !== null && row !== undefined;
}

const ARTICLE_COLUMNS = `a.id, a.subscription_id, a.title, a.author, a.published_at,
              a.summary, a.source_url, a.is_read`;

// ---------------------------------------------------------------- tags ----

export async function listTags(db: D1Database): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.slug, t.name, t.is_public, COUNT(at.article_id) AS count
       FROM tags t
       LEFT JOIN article_tags at ON at.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name COLLATE NOCASE ASC`
    )
    .all<{ id: string; slug: string; name: string; is_public: number; count: number }>();
  return (result.results ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    count: r.count,
    isPublic: r.is_public === 1,
  }));
}

export async function getTagBySlug(db: D1Database, slug: string): Promise<Tag | null> {
  const row = await db
    .prepare(
      `SELECT t.id, t.slug, t.name, t.is_public, COUNT(at.article_id) AS count
       FROM tags t LEFT JOIN article_tags at ON at.tag_id = t.id
       WHERE t.slug = ?
       GROUP BY t.id`
    )
    .bind(slug)
    .first<{ id: string; slug: string; name: string; is_public: number; count: number }>();
  return row
    ? { id: row.id, slug: row.slug, name: row.name, count: row.count, isPublic: row.is_public === 1 }
    : null;
}

/** Tags on one article. */
export async function listArticleTags(db: D1Database, articleId: string): Promise<Tag[]> {
  const result = await db
    .prepare(
      `SELECT t.id, t.slug, t.name, t.is_public
       FROM article_tags at JOIN tags t ON t.id = at.tag_id
       WHERE at.article_id = ?
       ORDER BY t.name COLLATE NOCASE ASC`
    )
    .bind(articleId)
    .all<{ id: string; slug: string; name: string; is_public: number }>();
  return (result.results ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    count: 0,
    isPublic: r.is_public === 1,
  }));
}

/**
 * Put a tag on an article, creating the tag the first time its name is used.
 * Tag names match without regard to case ("Cooking" and "cooking" are one tag).
 */
export async function addTagToArticle(db: D1Database, articleId: string, rawName: unknown): Promise<Tag> {
  const name = cleanName(rawName, 'Tag');
  const slug = slugify(name);
  if (slug === '') {
    throw validationError('Tag name must contain a letter or number');
  }
  if (!(await articleExists(db, articleId))) {
    throw notFoundError(`Article not found: ${articleId}`);
  }

  let tag = await db
    .prepare('SELECT id, slug, name, is_public FROM tags WHERE slug = ?')
    .bind(slug)
    .first<{ id: string; slug: string; name: string; is_public: number }>();

  if (!tag) {
    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)').bind(id, slug, name).run();
    tag = { id, slug, name, is_public: 0 };
  }

  await db
    .prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)')
    .bind(articleId, tag.id)
    .run();

  return { id: tag.id, slug: tag.slug, name: tag.name, count: 0, isPublic: tag.is_public === 1 };
}

/** Take a tag off one article. Returns false when the article did not have it. */
export async function removeTagFromArticle(db: D1Database, articleId: string, tagId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM article_tags WHERE article_id = ? AND tag_id = ?')
    .bind(articleId, tagId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/** Delete a tag everywhere. Returns false when it does not exist. */
export async function deleteTag(db: D1Database, tagId: string): Promise<boolean> {
  await db.prepare('DELETE FROM article_tags WHERE tag_id = ?').bind(tagId).run();
  const result = await db.prepare('DELETE FROM tags WHERE id = ?').bind(tagId).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listTagArticles(
  db: D1Database,
  tagId: string,
  limit = 50,
  offset = 0
): Promise<CollectionArticle[]> {
  const result = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS}, at.created_at AS added_at
       FROM article_tags at JOIN articles a ON a.id = at.article_id
       WHERE at.tag_id = ?
       ORDER BY at.created_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(tagId, limit, offset)
    .all<ArticleRow>();
  return (result.results ?? []).map(rowToArticle);
}

// ------------------------------------------------------------- folders ----

function validateFolderSlug(name: string): string {
  const slug = slugify(name);
  if (slug === '') {
    throw validationError('Folder name must contain a letter or number');
  }
  if (isReservedSlug(slug)) {
    throw validationError(`"${slug}" is used by the app. Pick another folder name`);
  }
  return slug;
}

export async function listFolders(db: D1Database): Promise<Folder[]> {
  const result = await db
    .prepare(
      `SELECT f.id, f.slug, f.name, f.sort_order, f.is_public, COUNT(fa.article_id) AS count
       FROM folders f
       LEFT JOIN folder_articles fa ON fa.folder_id = f.id
       GROUP BY f.id
       ORDER BY f.sort_order ASC, f.name COLLATE NOCASE ASC`
    )
    .all<{ id: string; slug: string; name: string; sort_order: number; is_public: number; count: number }>();
  return (result.results ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    order: r.sort_order,
    count: r.count,
    isPublic: r.is_public === 1,
  }));
}

export async function getFolderBySlug(db: D1Database, slug: string): Promise<Folder | null> {
  const row = await db
    .prepare(
      `SELECT f.id, f.slug, f.name, f.sort_order, f.is_public, COUNT(fa.article_id) AS count
       FROM folders f LEFT JOIN folder_articles fa ON fa.folder_id = f.id
       WHERE f.slug = ?
       GROUP BY f.id`
    )
    .bind(slug)
    .first<{ id: string; slug: string; name: string; sort_order: number; is_public: number; count: number }>();
  return row
    ? {
        id: row.id,
        slug: row.slug,
        name: row.name,
        order: row.sort_order,
        count: row.count,
        isPublic: row.is_public === 1,
      }
    : null;
}

export async function createFolder(db: D1Database, rawName: unknown): Promise<Folder> {
  const name = cleanName(rawName, 'Folder');
  const slug = validateFolderSlug(name);

  const taken = await db.prepare('SELECT 1 AS hit FROM folders WHERE slug = ?').bind(slug).first();
  if (taken) {
    throw conflictError(`A folder named "${slug}" already exists`);
  }

  const id = crypto.randomUUID();
  const max = await db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM folders')
    .first<{ max_order: number }>();
  const order = (max?.max_order ?? 0) + 1;

  await db
    .prepare('INSERT INTO folders (id, slug, name, sort_order) VALUES (?, ?, ?, ?)')
    .bind(id, slug, name, order)
    .run();

  return { id, slug, name, order, count: 0, isPublic: false };
}

export async function renameFolder(db: D1Database, folderId: string, rawName: unknown): Promise<Folder> {
  const name = cleanName(rawName, 'Folder');
  const slug = validateFolderSlug(name);

  const existing = await db.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
  if (!existing) {
    throw notFoundError(`Folder not found: ${folderId}`);
  }

  const clash = await db
    .prepare('SELECT id FROM folders WHERE slug = ? AND id != ?')
    .bind(slug, folderId)
    .first();
  if (clash) {
    throw conflictError(`A folder named "${slug}" already exists`);
  }

  await db.prepare('UPDATE folders SET name = ?, slug = ? WHERE id = ?').bind(name, slug, folderId).run();

  const updated = await db
    .prepare(
      `SELECT f.id, f.slug, f.name, f.sort_order, f.is_public, COUNT(fa.article_id) AS count
       FROM folders f LEFT JOIN folder_articles fa ON fa.folder_id = f.id
       WHERE f.id = ? GROUP BY f.id`
    )
    .bind(folderId)
    .first<{ id: string; slug: string; name: string; sort_order: number; is_public: number; count: number }>();
  return {
    id: folderId,
    slug,
    name,
    order: updated?.sort_order ?? 0,
    count: updated?.count ?? 0,
    isPublic: (updated?.is_public ?? 0) === 1,
  };
}

/** Delete a folder. The articles in it are not deleted. */
export async function deleteFolder(db: D1Database, folderId: string): Promise<boolean> {
  await db.prepare('DELETE FROM folder_articles WHERE folder_id = ?').bind(folderId).run();
  const result = await db.prepare('DELETE FROM folders WHERE id = ?').bind(folderId).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Folders that contain one article. */
export async function listArticleFolders(db: D1Database, articleId: string): Promise<Folder[]> {
  const result = await db
    .prepare(
      `SELECT f.id, f.slug, f.name, f.sort_order, f.is_public
       FROM folder_articles fa JOIN folders f ON f.id = fa.folder_id
       WHERE fa.article_id = ?
       ORDER BY f.sort_order ASC, f.name COLLATE NOCASE ASC`
    )
    .bind(articleId)
    .all<{ id: string; slug: string; name: string; sort_order: number; is_public: number }>();
  return (result.results ?? []).map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    order: r.sort_order,
    count: 0,
    isPublic: r.is_public === 1,
  }));
}

/** Add an article to a folder. Idempotent. */
export async function addArticleToFolder(
  db: D1Database,
  folderId: string,
  articleId: string
): Promise<void> {
  const folder = await db.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
  if (!folder) {
    throw notFoundError(`Folder not found: ${folderId}`);
  }
  if (!(await articleExists(db, articleId))) {
    throw notFoundError(`Article not found: ${articleId}`);
  }
  await db
    .prepare('INSERT OR IGNORE INTO folder_articles (folder_id, article_id) VALUES (?, ?)')
    .bind(folderId, articleId)
    .run();
}

/** Take an article out of a folder. Returns false when it was not in it. */
export async function removeArticleFromFolder(
  db: D1Database,
  folderId: string,
  articleId: string
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM folder_articles WHERE folder_id = ? AND article_id = ?')
    .bind(folderId, articleId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function listFolderArticles(
  db: D1Database,
  folderId: string,
  limit = 50,
  offset = 0
): Promise<CollectionArticle[]> {
  const result = await db
    .prepare(
      `SELECT ${ARTICLE_COLUMNS}, fa.added_at AS added_at
       FROM folder_articles fa JOIN articles a ON a.id = fa.article_id
       WHERE fa.folder_id = ?
       ORDER BY fa.added_at DESC, a.id DESC
       LIMIT ? OFFSET ?`
    )
    .bind(folderId, limit, offset)
    .all<ArticleRow>();
  return (result.results ?? []).map(rowToArticle);
}

// ------------------------------------------------------- public feeds ----

/** Turn the public feed of a tag on or off. Returns false when the tag is missing. */
export async function setTagPublic(db: D1Database, tagId: string, isPublic: boolean): Promise<boolean> {
  const result = await db.prepare('UPDATE tags SET is_public = ? WHERE id = ?').bind(isPublic ? 1 : 0, tagId).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Turn the public feed of a folder on or off. Returns false when the folder is missing. */
export async function setFolderPublic(db: D1Database, folderId: string, isPublic: boolean): Promise<boolean> {
  const result = await db
    .prepare('UPDATE folders SET is_public = ? WHERE id = ?')
    .bind(isPublic ? 1 : 0, folderId)
    .run();
  return (result.meta.changes ?? 0) > 0;
}
