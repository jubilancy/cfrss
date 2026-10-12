/**
 * Rules — automatic tagging, filing and marking-read of articles.
 *
 * A rule has conditions (a feed and/or a keyword) and actions (add a tag, add
 * to a folder, mark read). All of a rule's conditions must match. Rules run
 * when new articles are stored, and can be applied to existing articles.
 */

import { conflictError, notFoundError, validationError } from '../utils/errors';
import { slugify } from '../utils/slug';

export type MatchField = 'title' | 'any';

export interface Rule {
  id: string;
  name: string;
  feedId: string | null;
  matchField: MatchField;
  contains: string | null;
  addTag: string | null;
  folderId: string | null;
  markRead: boolean;
  enabled: boolean;
  order: number;
}

export interface RuleInput {
  name?: unknown;
  feedId?: unknown;
  matchField?: unknown;
  contains?: unknown;
  addTag?: unknown;
  folderId?: unknown;
  markRead?: unknown;
  enabled?: unknown;
}

/** The parts of an article a rule looks at. */
export interface RuleArticle {
  id: string;
  feedId: string;
  title: string;
  summary: string;
}

export const MAX_RULES = 50;
const MAX_NAME = 60;
const MAX_CONTAINS = 100;
const MAX_TAG = 50;
/** Existing articles checked when a rule is applied by hand. */
const APPLY_LIMIT = 500;

interface RuleRow {
  id: string;
  name: string;
  feed_id: string | null;
  match_field: string;
  contains: string | null;
  add_tag: string | null;
  folder_id: string | null;
  mark_read: number;
  enabled: number;
  sort_order: number;
}

function rowToRule(row: RuleRow): Rule {
  return {
    id: row.id,
    name: row.name,
    feedId: row.feed_id,
    matchField: row.match_field === 'any' ? 'any' : 'title',
    contains: row.contains,
    addTag: row.add_tag,
    folderId: row.folder_id,
    markRead: row.mark_read === 1,
    enabled: row.enabled === 1,
    order: row.sort_order,
  };
}

// ---------------------------------------------------------------- pure ----

function optionalText(value: unknown, max: number, what: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw validationError(`${what} must be text`);
  const text = value.trim().replace(/\s+/g, ' ');
  if (text === '') return null;
  if (text.length > max) throw validationError(`${what} must be at most ${max} characters`);
  return text;
}

/** Check and tidy rule input. Throws a validation error with a plain message. */
export function normalizeRuleInput(input: RuleInput): Omit<Rule, 'id' | 'order'> {
  const name = optionalText(input.name, MAX_NAME, 'Name') ?? '';
  const feedId = optionalText(input.feedId, 100, 'Feed');
  const contains = optionalText(input.contains, MAX_CONTAINS, 'Keyword');
  const addTag = optionalText(input.addTag, MAX_TAG, 'Tag');
  const folderId = optionalText(input.folderId, 100, 'Folder');

  const matchField = input.matchField === undefined || input.matchField === null ? 'title' : input.matchField;
  if (matchField !== 'title' && matchField !== 'any') {
    throw validationError('matchField must be "title" or "any"');
  }
  for (const [key, value] of [['markRead', input.markRead], ['enabled', input.enabled]] as const) {
    if (value !== undefined && typeof value !== 'boolean') throw validationError(`${key} must be true or false`);
  }
  const markRead = input.markRead === true;
  const enabled = input.enabled === undefined ? true : input.enabled === true;

  if (addTag !== null && slugify(addTag) === '') {
    throw validationError('Tag must contain a letter or number');
  }
  if (feedId === null && contains === null) {
    throw validationError('Pick a feed or a keyword for the rule to look for');
  }
  if (addTag === null && folderId === null && !markRead) {
    throw validationError('Pick at least one thing for the rule to do: tag, folder or mark read');
  }
  return { name, feedId, matchField, contains, addTag, folderId, markRead, enabled };
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

/** True when every condition of the rule matches the article. */
export function ruleMatches(rule: Pick<Rule, 'feedId' | 'matchField' | 'contains'>, article: RuleArticle): boolean {
  if (rule.feedId !== null && rule.feedId !== article.feedId) return false;
  if (rule.contains !== null) {
    const haystack =
      rule.matchField === 'title' ? article.title : `${article.title}\n${plainText(article.summary ?? '')}`;
    if (!haystack.toLowerCase().includes(rule.contains.toLowerCase())) return false;
  }
  return true;
}

// ------------------------------------------------------------ database ----

export async function listRules(db: D1Database): Promise<Rule[]> {
  const result = await db
    .prepare('SELECT * FROM rules ORDER BY sort_order ASC, created_at ASC')
    .all<RuleRow>();
  return (result.results ?? []).map(rowToRule);
}

async function getRule(db: D1Database, id: string): Promise<Rule | null> {
  const row = await db.prepare('SELECT * FROM rules WHERE id = ?').bind(id).first<RuleRow>();
  return row ? rowToRule(row) : null;
}

async function checkReferences(db: D1Database, rule: Pick<Rule, 'feedId' | 'folderId'>): Promise<void> {
  if (rule.feedId !== null) {
    const feed = await db.prepare('SELECT 1 AS hit FROM subscriptions WHERE id = ?').bind(rule.feedId).first();
    if (!feed) throw validationError('That feed does not exist');
  }
  if (rule.folderId !== null) {
    const folder = await db.prepare('SELECT 1 AS hit FROM folders WHERE id = ?').bind(rule.folderId).first();
    if (!folder) throw validationError('That folder does not exist');
  }
}

export async function createRule(db: D1Database, input: RuleInput): Promise<Rule> {
  const rule = normalizeRuleInput(input);
  await checkReferences(db, rule);

  const count = await db.prepare('SELECT COUNT(*) AS n FROM rules').first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_RULES) {
    throw conflictError(`You can have up to ${MAX_RULES} rules`);
  }
  const max = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM rules').first<{ m: number }>();
  const order = (max?.m ?? 0) + 1;
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO rules (id, name, feed_id, match_field, contains, add_tag, folder_id, mark_read, enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, rule.name, rule.feedId, rule.matchField, rule.contains, rule.addTag, rule.folderId, rule.markRead ? 1 : 0, rule.enabled ? 1 : 0, order)
    .run();
  return { id, order, ...rule };
}

export async function updateRule(db: D1Database, id: string, input: RuleInput): Promise<Rule> {
  const existing = await getRule(db, id);
  if (!existing) throw notFoundError(`Rule not found: ${id}`);

  // Fields that are not sent keep their current value.
  const merged: RuleInput = {
    name: 'name' in input ? input.name : existing.name,
    feedId: 'feedId' in input ? input.feedId : existing.feedId,
    matchField: 'matchField' in input ? input.matchField : existing.matchField,
    contains: 'contains' in input ? input.contains : existing.contains,
    addTag: 'addTag' in input ? input.addTag : existing.addTag,
    folderId: 'folderId' in input ? input.folderId : existing.folderId,
    markRead: 'markRead' in input ? input.markRead : existing.markRead,
    enabled: 'enabled' in input ? input.enabled : existing.enabled,
  };
  const rule = normalizeRuleInput(merged);
  await checkReferences(db, rule);

  await db
    .prepare(
      `UPDATE rules SET name = ?, feed_id = ?, match_field = ?, contains = ?, add_tag = ?,
              folder_id = ?, mark_read = ?, enabled = ? WHERE id = ?`
    )
    .bind(rule.name, rule.feedId, rule.matchField, rule.contains, rule.addTag, rule.folderId, rule.markRead ? 1 : 0, rule.enabled ? 1 : 0, id)
    .run();
  return { id, order: existing.order, ...rule };
}

export async function deleteRule(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM rules WHERE id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

/** Find or create a tag by name, remembering ids so a run does not repeat lookups. */
async function ensureTag(db: D1Database, name: string, cache: Map<string, string>): Promise<string> {
  const slug = slugify(name);
  const cached = cache.get(slug.toLowerCase());
  if (cached) return cached;
  const found = await db.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first<{ id: string }>();
  let id = found?.id;
  if (!id) {
    id = crypto.randomUUID();
    await db.prepare('INSERT OR IGNORE INTO tags (id, slug, name) VALUES (?, ?, ?)').bind(id, slug, name).run();
    // Another request may have created it first; read back the real id.
    const again = await db.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first<{ id: string }>();
    id = again?.id ?? id;
  }
  cache.set(slug.toLowerCase(), id);
  return id;
}

/** Carry out one rule's actions on one article. */
async function runActions(db: D1Database, rule: Rule, articleId: string, tagIds: Map<string, string>): Promise<void> {
  const statements: D1PreparedStatement[] = [];
  if (rule.addTag !== null) {
    const tagId = await ensureTag(db, rule.addTag, tagIds);
    statements.push(
      db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)').bind(articleId, tagId)
    );
  }
  if (rule.folderId !== null) {
    statements.push(
      db.prepare('INSERT OR IGNORE INTO folder_articles (folder_id, article_id) VALUES (?, ?)').bind(rule.folderId, articleId)
    );
  }
  if (rule.markRead) {
    statements.push(db.prepare('UPDATE articles SET is_read = 1 WHERE id = ?').bind(articleId));
  }
  if (statements.length > 0) await db.batch(statements);
}

export interface RuleApplier {
  /** Run every matching rule on a new article. Returns how many rules matched. */
  apply(article: RuleArticle): Promise<number>;
}

/**
 * Load the enabled rules once, for a refresh run. Returns null when there are
 * none, so the caller can skip all rule work.
 */
export async function createRuleApplier(db: D1Database): Promise<RuleApplier | null> {
  const rules = (await listRules(db)).filter((r) => r.enabled);
  if (rules.length === 0) return null;
  const tagIds = new Map<string, string>();
  return {
    async apply(article) {
      let matched = 0;
      for (const rule of rules) {
        if (!ruleMatches(rule, article)) continue;
        matched++;
        try {
          await runActions(db, rule, article.id, tagIds);
        } catch (error) {
          console.error(`[CFRSS] rule ${rule.id} failed on ${article.id}:`, error instanceof Error ? error.message : error);
        }
      }
      return matched;
    },
  };
}

export interface ApplyResult {
  checked: number;
  matched: number;
}

/** Apply one rule to the newest existing articles (up to a fixed limit). */
export async function applyRuleToExisting(db: D1Database, ruleId: string): Promise<ApplyResult> {
  const rule = await getRule(db, ruleId);
  if (!rule) throw notFoundError(`Rule not found: ${ruleId}`);

  const where = rule.feedId !== null ? 'WHERE subscription_id = ?' : '';
  const statement = db.prepare(
    `SELECT id, subscription_id, title, summary FROM articles ${where} ORDER BY published_at DESC LIMIT ${APPLY_LIMIT}`
  );
  const rows = await (rule.feedId !== null ? statement.bind(rule.feedId) : statement).all<{
    id: string;
    subscription_id: string;
    title: string;
    summary: string | null;
  }>();

  const tagIds = new Map<string, string>();
  let checked = 0;
  let matched = 0;
  for (const row of rows.results ?? []) {
    checked++;
    const article: RuleArticle = { id: row.id, feedId: row.subscription_id, title: row.title, summary: row.summary ?? '' };
    if (!ruleMatches(rule, article)) continue;
    matched++;
    await runActions(db, rule, row.id, tagIds);
  }
  return { checked, matched };
}
