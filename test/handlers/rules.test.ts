import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { setupTestDatabase } from '../setup';
import { createRuleApplier } from '../../src/services/rules';
import type { Env } from '../../src/types';

const TEST_ENV: Env = {
  DB: null as unknown as D1Database,
  ENCRYPTION_KEY: 'test-encryption-key-32bytes-long!',
  AUTH_TOKEN: 'test-auth-token',
};

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { Authorization: 'Bearer test-auth-token', 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return app.fetch(new Request(`http://localhost${path}`, init), TEST_ENV);
}

async function seedArticle(id: string, title: string): Promise<void> {
  await env.DB
    .prepare(
      `INSERT OR IGNORE INTO subscriptions (id, url, title, category_id)
       VALUES ('sub-1', 'https://example.com/feed.xml', 'Example Feed', 'default')`
    )
    .run();
  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO articles
         (id, subscription_id, title, author, published_at, summary, content_path, source_url, is_read)
       VALUES (?, 'sub-1', ?, 'Jane', '2026-09-01T10:00:00.000Z', 'summary', 'p/1.md', 'https://example.com/a', 0)`
    )
    .bind(id, title)
    .run();
}

describe('Rules API', () => {
  beforeEach(async () => {
    TEST_ENV.DB = env.DB;
    await setupTestDatabase(env.DB);
    for (const table of ['rules', 'folder_articles', 'article_tags', 'folders', 'tags', 'articles', 'subscriptions']) {
      await env.DB.prepare(`DELETE FROM ${table}`).run();
    }
  });

  it('creates, lists, updates and deletes a rule', async () => {
    const created = await req('POST', '/api/rules', { contains: 'pasta', addTag: 'food' });
    expect(created.status).toBe(201);
    const { rule } = (await created.json()) as { rule: { id: string; enabled: boolean } };
    expect(rule.enabled).toBe(true);

    const list = (await (await req('GET', '/api/rules')).json()) as { rules: unknown[] };
    expect(list.rules).toHaveLength(1);

    const updated = await req('PUT', `/api/rules/${rule.id}`, { contains: 'pasta', addTag: 'food', enabled: false });
    expect(((await updated.json()) as { rule: { enabled: boolean } }).rule.enabled).toBe(false);

    expect((await req('DELETE', `/api/rules/${rule.id}`)).status).toBe(200);
    expect((await req('DELETE', `/api/rules/${rule.id}`)).status).toBe(404);
  });

  it('rejects a rule with no action', async () => {
    const res = await req('POST', '/api/rules', { contains: 'pasta' });
    expect(res.status).toBe(400);
  });

  it('applies a rule to existing articles', async () => {
    await seedArticle('a1', 'Pasta night');
    await seedArticle('a2', 'Tax news');
    const created = await req('POST', '/api/rules', { contains: 'pasta', addTag: 'food', markRead: true });
    const { rule } = (await created.json()) as { rule: { id: string } };

    const res = await req('POST', `/api/rules/${rule.id}/apply`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ checked: 2, matched: 1 });

    const tagged = await env.DB.prepare('SELECT article_id FROM article_tags').all<{ article_id: string }>();
    expect(tagged.results.map((r) => r.article_id)).toEqual(['a1']);
    const read = await env.DB.prepare('SELECT id FROM articles WHERE is_read = 1').all<{ id: string }>();
    expect(read.results.map((r) => r.id)).toEqual(['a1']);
  });

  it('applies rules to a new article through the applier', async () => {
    await seedArticle('a1', 'Pasta night');
    await req('POST', '/api/rules', { feedId: 'sub-1', addTag: 'everything' });
    await req('POST', '/api/rules', { contains: 'nothing-matches', markRead: true });

    const applier = await createRuleApplier(env.DB);
    expect(applier).not.toBeNull();
    const matched = await applier!.apply({ id: 'a1', feedId: 'sub-1', title: 'Pasta night', summary: '' });
    expect(matched).toBe(1);
    const tagged = await env.DB.prepare('SELECT article_id FROM article_tags').all();
    expect(tagged.results).toHaveLength(1);
  });
});
