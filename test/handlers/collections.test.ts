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

function req(method: string, path: string, body?: unknown) {
  const init: RequestInit = {
    method,
    headers: { Authorization: 'Bearer test-auth-token', 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return app.fetch(new Request(`http://localhost${path}`, init), TEST_ENV);
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
       VALUES (?, 'sub-1', ?, 'Jane', '2026-09-01T10:00:00.000Z', 'summary', 'p/1.md', 'https://example.com/a', 0)`
    )
    .bind(id, `Article ${id}`)
    .run();
}

describe('Tags and folders API', () => {
  beforeEach(async () => {
    TEST_ENV.DB = env.DB;
    await setupTestDatabase(env.DB);
    await env.DB.prepare('DELETE FROM folder_articles').run();
    await env.DB.prepare('DELETE FROM article_tags').run();
    await env.DB.prepare('DELETE FROM folders').run();
    await env.DB.prepare('DELETE FROM tags').run();
    await env.DB.prepare('DELETE FROM articles').run();
    await env.DB.prepare('DELETE FROM subscriptions').run();
  });

  describe('tags', () => {
    it('creates a tag on first use and reuses it ignoring case', async () => {
      await seedArticle('a1');
      await seedArticle('a2');

      const first = await req('POST', '/api/articles/a1/tags', { name: 'Cooking' });
      expect(first.status).toBe(201);
      const firstBody = (await first.json()) as { tag: { id: string; slug: string; name: string } };
      expect(firstBody.tag.slug).toBe('Cooking');

      const second = await req('POST', '/api/articles/a2/tags', { name: 'cooking' });
      const secondBody = (await second.json()) as { tag: { id: string } };
      expect(secondBody.tag.id).toBe(firstBody.tag.id);

      const list = (await (await req('GET', '/api/tags')).json()) as { tags: Array<{ name: string; count: number }> };
      expect(list.tags).toHaveLength(1);
      expect(list.tags[0]).toMatchObject({ name: 'Cooking', count: 2 });
    });

    it('tagging twice does not duplicate', async () => {
      await seedArticle('a1');
      await req('POST', '/api/articles/a1/tags', { name: 'rust' });
      await req('POST', '/api/articles/a1/tags', { name: 'rust' });
      const org = (await (await req('GET', '/api/articles/a1/organize')).json()) as { tags: unknown[] };
      expect(org.tags).toHaveLength(1);
    });

    it('lists the articles for a tag by slug, any case', async () => {
      await seedArticle('a1');
      await req('POST', '/api/articles/a1/tags', { name: 'Cooking' });
      const res = await req('GET', '/api/tags/cooking/articles');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { tag: { name: string }; articles: Array<{ id: string }> };
      expect(body.tag.name).toBe('Cooking');
      expect(body.articles.map((a) => a.id)).toEqual(['a1']);
    });

    it('returns 404 for an unknown tag and for tagging a missing article', async () => {
      expect((await req('GET', '/api/tags/nope/articles')).status).toBe(404);
      expect((await req('POST', '/api/articles/missing/tags', { name: 'x' })).status).toBe(404);
    });

    it('rejects an empty or unusable tag name', async () => {
      await seedArticle('a1');
      expect((await req('POST', '/api/articles/a1/tags', { name: '' })).status).toBe(400);
      expect((await req('POST', '/api/articles/a1/tags', { name: '!!!' })).status).toBe(400);
      expect((await req('POST', '/api/articles/a1/tags', { name: 'x'.repeat(51) })).status).toBe(400);
    });

    it('removes a tag from an article and deletes a tag everywhere', async () => {
      await seedArticle('a1');
      const created = (await (await req('POST', '/api/articles/a1/tags', { name: 'rust' })).json()) as {
        tag: { id: string };
      };
      expect((await req('DELETE', `/api/articles/a1/tags/${created.tag.id}`)).status).toBe(200);
      expect((await req('DELETE', `/api/articles/a1/tags/${created.tag.id}`)).status).toBe(404);

      await req('POST', '/api/articles/a1/tags', { name: 'rust' });
      expect((await req('DELETE', `/api/tags/${created.tag.id}`)).status).toBe(200);
      const list = (await (await req('GET', '/api/tags')).json()) as { tags: unknown[] };
      expect(list.tags).toEqual([]);
    });
  });

  describe('folders', () => {
    it('creates a folder with a slug that keeps capitalisation', async () => {
      const res = await req('POST', '/api/folders', { name: 'TBR' });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { folder: { slug: string; name: string; count: number } };
      expect(body.folder).toMatchObject({ slug: 'TBR', name: 'TBR', count: 0 });
    });

    it('refuses names the app uses', async () => {
      for (const name of ['settings', 'Tag', 'API', 'feed']) {
        const res = await req('POST', '/api/folders', { name });
        expect(res.status, name).toBe(400);
      }
    });

    it('refuses a duplicate folder ignoring case', async () => {
      await req('POST', '/api/folders', { name: 'TBR' });
      expect((await req('POST', '/api/folders', { name: 'tbr' })).status).toBe(409);
    });

    it('adds and removes articles, and lists them by slug in any case', async () => {
      await seedArticle('a1');
      const created = (await (await req('POST', '/api/folders', { name: 'TBR' })).json()) as {
        folder: { id: string };
      };
      const id = created.folder.id;

      expect((await req('PUT', `/api/folders/${id}/articles/a1`)).status).toBe(200);
      expect((await req('PUT', `/api/folders/${id}/articles/a1`)).status).toBe(200);

      const listed = (await (await req('GET', '/api/folders/tbr/articles')).json()) as {
        folder: { count: number };
        articles: Array<{ id: string }>;
      };
      expect(listed.folder.count).toBe(1);
      expect(listed.articles.map((a) => a.id)).toEqual(['a1']);

      const org = (await (await req('GET', '/api/articles/a1/organize')).json()) as {
        folders: Array<{ id: string }>;
      };
      expect(org.folders.map((f) => f.id)).toEqual([id]);

      expect((await req('DELETE', `/api/folders/${id}/articles/a1`)).status).toBe(200);
      expect((await req('DELETE', `/api/folders/${id}/articles/a1`)).status).toBe(404);
    });

    it('returns 404 adding a missing article or to a missing folder', async () => {
      await seedArticle('a1');
      const created = (await (await req('POST', '/api/folders', { name: 'TBR' })).json()) as {
        folder: { id: string };
      };
      expect((await req('PUT', `/api/folders/${created.folder.id}/articles/missing`)).status).toBe(404);
      expect((await req('PUT', '/api/folders/missing/articles/a1')).status).toBe(404);
      expect((await req('GET', '/api/folders/nope/articles')).status).toBe(404);
    });

    it('renames a folder and deletes it without deleting its articles', async () => {
      await seedArticle('a1');
      const created = (await (await req('POST', '/api/folders', { name: 'TBR' })).json()) as {
        folder: { id: string };
      };
      await req('PUT', `/api/folders/${created.folder.id}/articles/a1`);

      const renamed = await req('PUT', `/api/folders/${created.folder.id}`, { name: 'To Read' });
      expect(renamed.status).toBe(200);
      const renamedBody = (await renamed.json()) as { folder: { slug: string; count: number } };
      expect(renamedBody.folder).toMatchObject({ slug: 'To-Read', count: 1 });

      expect((await req('DELETE', `/api/folders/${created.folder.id}`)).status).toBe(200);
      expect((await req('DELETE', `/api/folders/${created.folder.id}`)).status).toBe(404);
      const article = await env.DB.prepare('SELECT id FROM articles WHERE id = ?').bind('a1').first();
      expect(article).not.toBeNull();
    });
  });
});
