import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../../src/utils/language';

describe('detectLanguage', () => {
  it.each(['en', 'en-US', 'fr', 'ja', 'zh', 'zh-CN', ''])(
    'returns "en" for %j (interface is English-only)',
    (input) => {
      expect(detectLanguage(input)).toBe('en');
    },
  );
});
