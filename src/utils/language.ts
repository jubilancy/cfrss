/**
 * Language detection utility.
 * Shared between client and server code.
 */

export type SupportedLanguage = 'en';

/**
 * The interface is English-only. Kept as a function so additional UI
 * languages can be added later without touching callers.
 */
export function detectLanguage(_navigatorLang: string): SupportedLanguage {
  return 'en';
}
