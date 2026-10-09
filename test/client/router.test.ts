import { describe, it, expect } from 'vitest';
import { parseHash, parsePath, listPath, articlePath, tagPath, folderPath } from '../../src/client/router';

describe('Router - parseHash', () => {
  it('parses empty hash as home route', () => {
    const route = parseHash('');
    expect(route.path).toBe('home');
    expect(route.params).toEqual({});
  });

  it('parses #/ as home route', () => {
    const route = parseHash('#/');
    expect(route.path).toBe('home');
    expect(route.params).toEqual({});
  });

  it('parses #/subscriptions', () => {
    const route = parseHash('#/subscriptions');
    expect(route.path).toBe('subscriptions');
    expect(route.params).toEqual({});
  });

  it('parses #/articles', () => {
    const route = parseHash('#/articles');
    expect(route.path).toBe('articles');
    expect(route.params).toEqual({});
  });

  it('parses #/articles/:id with param', () => {
    const route = parseHash('#/articles/abc-123');
    expect(route.path).toBe('article-detail');
    expect(route.params).toEqual({ id: 'abc-123' });
  });

  it('parses #/settings', () => {
    const route = parseHash('#/settings');
    expect(route.path).toBe('settings');
    expect(route.params).toEqual({});
  });

  it('parses #/bookmarks', () => {
    const route = parseHash('#/bookmarks');
    expect(route.path).toBe('bookmarks');
    expect(route.params).toEqual({});
  });

  it('parses #/digest', () => {
    const route = parseHash('#/digest');
    expect(route.path).toBe('digest');
    expect(route.params).toEqual({});
  });

  it('returns home for unknown routes with more than one segment', () => {
    const route = parseHash('#/unknown/deeper/path');
    expect(route.path).toBe('home');
    expect(route.params).toEqual({});
  });

  it('treats an unknown single segment as a folder name', () => {
    const route = parseHash('#/unknown');
    expect(route.path).toBe('folder');
    expect(route.params).toEqual({ slug: 'unknown' });
  });

  it('handles article IDs with special characters', () => {
    const route = parseHash('#/articles/foo-bar_123.json');
    expect(route.path).toBe('article-detail');
    expect(route.params.id).toBe('foo-bar_123.json');
  });
});

describe('Router - parsePath (clean URLs)', () => {
  it('parses / as home', () => {
    expect(parsePath('/').path).toBe('home');
    expect(parsePath('').path).toBe('home');
  });

  it('parses the simple pages', () => {
    for (const name of ['articles', 'bookmarks', 'digest', 'subscriptions', 'settings']) {
      expect(parsePath(`/${name}`).path).toBe(name);
      expect(parsePath(`/${name}/`).path).toBe(name);
    }
  });

  it('parses an article and its id', () => {
    const route = parsePath('/articles/abc-123');
    expect(route.path).toBe('article-detail');
    expect(route.params).toEqual({ id: 'abc-123' });
    expect(route.query).toEqual({});
  });

  it('parses a feed filter as a path', () => {
    const route = parsePath('/feed/f1');
    expect(route.path).toBe('articles');
    expect(route.query).toEqual({ subscription: 'f1' });
  });

  it('parses a category filter as a path', () => {
    const route = parsePath('/category/c1');
    expect(route.path).toBe('articles');
    expect(route.query).toEqual({ category: 'c1' });
  });

  it('keeps the filter when opening an article', () => {
    const feed = parsePath('/feed/f1/articles/a9');
    expect(feed.path).toBe('article-detail');
    expect(feed.params).toEqual({ id: 'a9' });
    expect(feed.query).toEqual({ subscription: 'f1' });

    const cat = parsePath('/category/c1/articles/a9');
    expect(cat.path).toBe('article-detail');
    expect(cat.query).toEqual({ category: 'c1' });
  });

  it('still reads an old-style ?query', () => {
    const route = parsePath('/articles?subscription=x');
    expect(route.path).toBe('articles');
    expect(route.query).toEqual({ subscription: 'x' });
  });

  it('maps an old hash link to the same route', () => {
    expect(parseHash('#/articles?subscription=x')).toEqual(parsePath('/articles?subscription=x'));
  });

  it('falls back to home for unknown paths', () => {
    expect(parsePath('/nope/at/all').path).toBe('home');
  });
});

describe('Router - path builders', () => {
  it('builds list paths', () => {
    expect(listPath({ feedId: null, categoryId: null })).toBe('/articles');
    expect(listPath({ feedId: 'f1', categoryId: null })).toBe('/feed/f1');
    expect(listPath({ feedId: null, categoryId: 'c1' })).toBe('/category/c1');
  });

  it('builds article paths and round-trips through the parser', () => {
    expect(articlePath('a1')).toBe('/articles/a1');
    expect(articlePath('a1', { feedId: 'f1', categoryId: null })).toBe('/feed/f1/articles/a1');
    expect(articlePath('a1', { feedId: null, categoryId: 'c1' })).toBe('/category/c1/articles/a1');
    expect(parsePath(articlePath('a1', { feedId: 'f1', categoryId: null })).params.id).toBe('a1');
  });
});

describe('Router - tags, folders and the library', () => {
  it('parses a tag page', () => {
    const route = parsePath('/tag/cooking');
    expect(route.path).toBe('tag');
    expect(route.params).toEqual({ slug: 'cooking' });
  });

  it('parses a folder at the root, keeping its capitalisation', () => {
    const route = parsePath('/TBR');
    expect(route.path).toBe('folder');
    expect(route.params).toEqual({ slug: 'TBR' });
  });

  it('decodes encoded names', () => {
    expect(parsePath('/%E9%A3%9F%E8%B0%B1').params).toEqual({ slug: '食谱' });
    expect(parsePath('/tag/caf%C3%A9').params).toEqual({ slug: 'café' });
  });

  it('parses the library page', () => {
    expect(parsePath('/library').path).toBe('library');
  });

  it('keeps app paths as app pages, never folders', () => {
    expect(parsePath('/settings').path).toBe('settings');
    expect(parsePath('/bookmarks').path).toBe('bookmarks');
    expect(parsePath('/SETTINGS').path).toBe('home');
  });

  it('does not treat reserved or file-like paths as folders', () => {
    expect(parsePath('/tag').path).toBe('home');
    expect(parsePath('/feed').path).toBe('home');
    expect(parsePath('/api').path).toBe('home');
    expect(parsePath('/manifest.json').path).toBe('home');
  });

  it('builds tag and folder paths', () => {
    expect(tagPath('cooking')).toBe('/tag/cooking');
    expect(folderPath('TBR')).toBe('/TBR');
    expect(parsePath(folderPath('食谱')).params.slug).toBe('食谱');
    expect(parsePath(tagPath('café')).params.slug).toBe('café');
  });
});
