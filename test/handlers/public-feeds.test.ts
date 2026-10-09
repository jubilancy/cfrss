import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { setupTestDatabase } from '../setup';
import type { Env } from '../../src/types';

const TEST_ENV: Env = {
  DB: null as unknown as D1Database,
  ENCRYPTION_KEY: 'test-encryption-key-32bytes-long!',
  AUTH_TOKEN: 'test-auth-token',
};

/** Signed-in API call. */
function api(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { Authorization: 'Bearer test-auth-token', 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return app.fetch(new Request(`http://localhost${path}`, init), TEST_ENV);
}

/** Anonymous call, like a feed reader. */
function anon(path: string) {
  return app.fetch(new Request(`http://localhost${path}`), TEST_ENV);
}

async function seedArticle(id: string): Promise<void> {
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
       VALUES (?, 'sub-1', ?, 'Jane', '2026-09-01T10:00:00.000Z', '<p>An excerpt</p>', 'p/1.md', ?, 0)`
    )
    .bind(id, `Article ${id}`, `https://example.com/${id}`)
    .run();
}

describe('Public feeds', () => {
  beforeEach(async () => {
    TEST_ENV.DB = env.DB;
    await setupTestDatabase(env.DB);
    for (const table of ['folder_articles', 'article_tags', 'folders', 'tags', 'articles', 'subscriptions']) {
      await env.DB.prepare(`DELETE FROM ${table}`).run();
    }
  });

  it('keeps a new tag private: its feed is a 404', async () => {
    await seedArticle('a1');
    await api('POST', '/api/articles/a1/tags', { name: 'Cooking' });
    expect((await anon('/tag/Cooking/feed.xml')).status).toBe(404);
    expect((await anon('/tag/Cooking/feed.json')).status).toBe(404);
  });

  it('serves a public tag feed without a login, in either case', async () => {
    await seedArticle('a1');
    const created = (await (await api('POST', '/api/articles/a1/tags', { name: 'Cooking' })).json()) as {
      tag: { id: string };
    };
    expect((await api('PUT', `/api/tags/${created.tag.id}/public`, { public: true })).status).toBe(200);

    const rss = await anon('/tag/cooking/feed.xml');
    expect(rss.status).toBe(200);
    expect(rss.headers.get('Content-Type')).toContain('application/rss+xml');
    expect(rss.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const xml = await rss.text();
    expect(xml).toContain('<title>Cooking</title>');
    expect(xml).toContain('https://example.com/a1');
    expect(xml).toContain('An excerpt');
    expect(xml).toContain('<url>http://localhost/icons/icon-256x256.png</url>');

    const json = await anon('/tag/Cooking/feed.json');
    expect(json.status).toBe(200);
    expect(json.headers.get('Content-Type')).toContain('application/feed+json');
    const body = (await json.json()) as { items: Array<{ url: string }> };
    expect(body.items.map((i) => i.url)).toEqual(['https://example.com/a1']);
  });

  it('serves a public folder feed at the root, and hides it again when switched off', async () => {
    await seedArticle('a1');
    const folder = (await (await api('POST', '/api/folders', { name: 'TBR' })).json()) as { folder: { id: string } };
    await api('PUT', `/api/folders/${folder.folder.id}/articles/a1`);

    expect((await anon('/TBR/feed.xml')).status).toBe(404);

    await api('PUT', `/api/folders/${folder.folder.id}/public`, { public: true });
    const res = await anon('/tbr/feed.xml');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>TBR</title>');
    expect((await anon('/TBR/feed.json')).status).toBe(200);

    await api('PUT', `/api/folders/${folder.folder.id}/public`, { public: false });
    expect((await anon('/TBR/feed.xml')).status).toBe(404);
  });

  it('answers 404 for names that do not exist or that the app owns', async () => {
    expect((await anon('/nothing/feed.xml')).status).toBe(404);
    expect((await anon('/tag/nothing/feed.xml')).status).toBe(404);
    expect((await anon('/settings/feed.xml')).status).toBe(404);
  });

  it('shows the public flag in the lists', async () => {
    const folder = (await (await api('POST', '/api/folders', { name: 'TBR' })).json()) as { folder: { id: string } };
    await api('PUT', `/api/folders/${folder.folder.id}/public`, { public: true });
    const list = (await (await api('GET', '/api/folders')).json()) as { folders: Array<{ isPublic: boolean }> };
    expect(list.folders[0].isPublic).toBe(true);
  });

  it('requires a login and a boolean to change the setting', async () => {
    const folder = (await (await api('POST', '/api/folders', { name: 'TBR' })).json()) as { folder: { id: string } };
    const noAuth = await app.fetch(
      new Request(`http://localhost/api/folders/${folder.folder.id}/public`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public: true }),
      }),
      TEST_ENV
    );
    expect(noAuth.status).toBe(401);
    expect((await api('PUT', `/api/folders/${folder.folder.id}/public`, { public: 'yes' })).status).toBe(400);
    expect((await api('PUT', '/api/folders/missing/public', { public: true })).status).toBe(404);
    expect((await api('PUT', '/api/tags/missing/public', { public: true })).status).toBe(404);
  });
});
