import { describe, it, expect } from 'vitest';
import { slugify, isReservedSlug } from '../../src/utils/slug';

describe('slugify', () => {
  it('keeps capitalisation', () => {
    expect(slugify('TBR')).toBe('TBR');
  });

  it('turns spaces and punctuation into single dashes', () => {
    expect(slugify('  Read   later!! ')).toBe('Read-later');
    expect(slugify('rust & go')).toBe('rust-go');
  });

  it('keeps letters from other languages', () => {
    expect(slugify('食谱')).toBe('食谱');
    expect(slugify('café')).toBe('café');
  });

  it('returns an empty string when nothing is usable', () => {
    expect(slugify('!!! ???')).toBe('');
    expect(slugify('')).toBe('');
  });
});

describe('isReservedSlug', () => {
  it('reserves app paths in any case', () => {
    for (const name of ['tag', 'Tag', 'SETTINGS', 'api', 'feed', 'category', 'bookmarks']) {
      expect(isReservedSlug(name)).toBe(true);
    }
  });

  it('allows ordinary names', () => {
    expect(isReservedSlug('TBR')).toBe(false);
    expect(isReservedSlug('recipes')).toBe(false);
  });
});
