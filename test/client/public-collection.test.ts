import { describe, it, expect } from 'vitest';
import { publicFeedPath } from '../../src/client/components/collection/PublicCollectionView';
import { parsePath } from '../../src/client/router';

describe('public collection page', () => {
  it('points at the matching public JSON feed', () => {
    expect(publicFeedPath('/TBR')).toBe('/TBR/feed.json');
    expect(publicFeedPath('/TBR/')).toBe('/TBR/feed.json');
    expect(publicFeedPath('/tag/cooking')).toBe('/tag/cooking/feed.json');
  });

  it('is only used for folder and tag addresses', () => {
    expect(parsePath('/TBR').path).toBe('folder');
    expect(parsePath('/tag/cooking').path).toBe('tag');
    // Everything else goes to the normal sign-in
    expect(parsePath('/settings').path).toBe('settings');
    expect(parsePath('/').path).toBe('home');
  });
});
