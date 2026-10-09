import { describe, it, expect, beforeEach } from 'vitest';
import {
  translations,
  t,
  setLanguage,
  getLanguage,
  initI18n,
  onLanguageChange,
  getTranslationKeys,
} from '../../../src/client/services/i18n';

describe('i18n module', () => {
  beforeEach(() => {
    setLanguage('en');
  });

  describe('translations', () => {
    it('only ships an English dictionary', () => {
      expect(Object.keys(translations)).toEqual(['en']);
    });

    it('no translation value is empty string', () => {
      for (const [key, value] of Object.entries(translations.en)) {
        expect(value.length, `en.${key} should not be empty`).toBeGreaterThan(0);
      }
    });
  });

  describe('t() function', () => {
    it('returns English translations', () => {
      expect(t('home')).toBe('Home');
      expect(t('subscriptions')).toBe('Subscriptions');
      expect(t('daily_digest')).toBe('Daily Digest');
    });

    it('returns the key itself for unknown keys', () => {
      expect(t('nonexistent_key')).toBe('nonexistent_key');
    });
  });

  describe('language switching', () => {
    it('setLanguage keeps the active language', () => {
      setLanguage('en');
      expect(getLanguage()).toBe('en');
    });

    it('does not notify if setting same language', () => {
      const changes: string[] = [];
      const unsubscribe = onLanguageChange((lang) => changes.push(lang));
      setLanguage('en');
      expect(changes).toEqual([]);
      unsubscribe();
    });
  });

  describe('auto-detection', () => {
    it.each(['zh-CN', 'zh-TW', 'zh', 'en-US', 'fr', 'ja', ''])(
      'uses en for navigator language %j',
      (lang) => {
        initI18n(lang);
        expect(getLanguage()).toBe('en');
      },
    );
  });

  describe('getTranslationKeys', () => {
    it('returns all keys from translations', () => {
      const keys = getTranslationKeys();
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).toContain('home');
      expect(keys).toContain('daily_digest');
      expect(keys).toContain('offline_mode');
    });
  });
});
