/**
 * Internationalization (i18n) module for the RSS Reader client.
 * English-only interface. Chinese remains available as an article
 * translation target (see utils/translate-languages.ts).
 */

import { detectLanguage, type SupportedLanguage } from '../../utils/language';

export type { SupportedLanguage } from '../../utils/language';

export type TranslationKey = keyof typeof translations.en;

type LanguageChangeListener = (lang: SupportedLanguage) => void;

/**
 * All UI translation keys organized by category.
 * Add new UI languages here as additional dictionaries.
 */
export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Navigation
    home: 'Home',
    subscriptions: 'Subscriptions',
    articles: 'Articles',
    settings: 'Settings',

    // Actions
    add: 'Add',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    refresh: 'Refresh',
    retry: 'Retry',
    skip: 'Skip',
    confirm: 'Confirm',

    // Subscriptions
    add_subscription: 'Add Subscription',
    delete_subscription: 'Delete Subscription',
    move_to_category: 'Move to Category',
    no_subscriptions: 'No subscriptions yet',

    // Categories
    add_category: 'Add Category',
    rename_category: 'Rename Category',
    delete_category: 'Delete Category',
    uncategorized: 'Uncategorized',

    // Articles
    no_articles: 'No articles yet',
    no_unread: 'No unread articles',
    mark_read: 'Mark as Read',
    mark_unread: 'Mark as Unread',
    unread: 'Unread',
    no_more_articles: 'No more articles',

    // LLM
    summarize: 'Summarize',
    translate: 'Translate',
    read_aloud: 'Read Aloud',
    generating: 'Generating…',
    translating: 'Translating…',
    show_original: 'Show Original',

    // Digest
    daily_digest: 'Daily Digest',
    no_new_content: 'No new content today',
    loading_digest: 'Generating digest…',

    // Settings
    theme: 'Theme',
    language: 'Language',
    llm_config: 'LLM Config',
    github_config: 'GitHub Config',

    // Theme
    light: 'Light',
    dark: 'Dark',
    oled: 'OLED Black',
    eink: 'E-Ink White',

    // Errors
    timeout: 'Request Timeout',
    network_error: 'Network Error',
    not_found: 'Not Found',
    validation_error: 'Validation Error',

    // OPML
    import_opml: 'Import OPML',
    export_opml: 'Export OPML',
    import_success: 'Import Successful',
    import_failed: 'Import Failed',

    // PWA
    offline_mode: 'Offline Mode',
    update_available: 'Update Available',
    refresh_to_update: 'Refresh to Update',

    // Auth
    login_title: 'CF RSS Reader',
    login_subtitle: 'Enter your access token to sign in',
    login_token_placeholder: 'Access token',
    login_button: 'Sign In',
    login_verifying: 'Verifying…',
    login_error: 'Invalid token, please try again',
    marked_abnormal: 'This feed failed to refresh repeatedly and has been marked abnormal. Re-enable it in settings.',
    all_articles: 'All Articles',
    unread_only: 'Unread only',
    all: 'All',
    select_article_hint: 'Select an article to start reading',
    time_now: 'just now',
    time_minutes: 'min ago',
    time_hours: 'hr ago',
    time_days: 'd ago',
    digest: 'Digest',
    enable: 'Re-enable',
    settings_theme_desc: 'Switch between light, dark, OLED black and e-ink themes',
    settings_language_desc: 'Choose the interface language',
    settings_llm_desc: 'Configure AI models for summarize and translate',
    settings_github_desc: 'GitHub repository where article content is archived',
    edit_subscription: 'Edit subscription',

    // Password
    password: 'Access Password',
    settings_password_desc: 'Change the password used to sign in to this app',
    password_current: 'Current password',
    password_new: 'New password',
    password_confirm: 'Confirm new password',
    password_save: 'Change password',
    password_reset: 'Restore initial token',
    password_success: 'Password changed. This device stays signed in.',
    password_reset_success: 'Restored the server bootstrap token.',
    password_error_short: 'New password must be at least 6 characters.',
    password_error_mismatch: 'The two new passwords do not match.',
    password_error_current: 'Current password is incorrect.',
    password_error_current_required: 'Please enter the current password.',
    password_error_generic: 'Operation failed, please try again later.',

    // Mobile article list
    favorites: 'Favorites',
    select_all: 'Select all',
    mark_all_read: 'Mark all as read',
    unread_count: 'Unread',

    // Bookmarks (收藏)
    bookmarks: 'Bookmarks',
    bookmark_add: 'Bookmark this article',
    bookmark_remove: 'Remove bookmark',
    bookmark_save_failed: 'Failed to bookmark. Please try again.',
    bookmarks_empty: 'No bookmarks yet',
    bookmarks_hint: 'Tap the bookmark button on an article and it will show up here',
    load_bookmarks_failed: 'Failed to load bookmarks. Please try again.',
    remove_bookmark_failed: 'Failed to remove bookmark. Please try again.',
    bookmarked_at: 'Saved',

    // Tags, folders and the library
    library: 'Library',
    folders: 'Folders',
    tags: 'Tags',
    organize: 'Organize',
    organize_failed: 'That did not work. Please try again.',
    add_tag: 'Add tag',
    add_tag_placeholder: 'Add a tag…',
    new_folder: 'New folder',
    new_folder_placeholder: 'New folder name…',
    create: 'Create',
    rename_folder_prompt: 'Rename folder',
    delete_folder: 'Delete folder',
    delete_folder_confirm: 'Delete this folder? The articles in it are kept.',
    remove_from_collection: 'Take out of this list',
    collection_empty: 'Nothing here yet',
    collection_empty_hint: 'Open an article and use Organize to add it',
    collection_not_found: 'That list does not exist',
    load_collection_failed: 'Failed to load this list. Please try again.',
    library_empty_folders: 'No folders yet',
    library_empty_tags: 'No tags yet',
    added_to_list: 'Added',
    public_feed: 'Public feed',
    public_feed_hint: 'Anyone with the link can read titles, links and short excerpts. Full articles are never shared.',
    public_feed_rss: 'RSS',
    public_feed_json: 'JSON',
    public_feed_failed: 'Could not change the public feed. Please try again.',
    public_page_footer: 'Shared from a personal reader. Titles link to the original sites.',

    // Loading / error states
    loading: 'Loading…',
    load_articles_failed: 'Failed to load articles. Please try again.',
    load_article_failed: 'Failed to load article. Please try again.',
    connection_failed: 'Connection failed',
    playback_failed: 'Playback failed',
    load_failed: 'Load failed',
    delete_failed: 'Delete failed',
    export_failed: 'Export failed',
    dismiss: 'Dismiss',
    network_request_failed: 'Network request failed',
    request_failed: 'Request failed',
    loading_article: 'Loading article…',

    // A11y labels
    main_navigation: 'Main navigation',
    feeds: 'Feeds',
    collapse: 'Collapse',
    expand: 'Expand',
    article_list_label: 'Article list',
    summary_label: 'Article summary',
    translation_label: 'Article translation',
    read_aloud_player_label: 'Read aloud player',

    // Player
    pause: 'Pause',
    resume: 'Resume',
    stop: 'Stop',
    no_previous_article: 'No previous article',
    tts_unconfigured: 'Configure the read-aloud service in Settings first',
    tts_request_failed: 'TTS request failed',

    // Translation panel
    original_content: 'Original',
    translated_content: 'Translation',
    mode_dual: 'Dual-line',
    mode_side_by_side: 'Side by side',
    mode_replace: 'Translation only',
    switch_to_dual: 'Switch to dual-line view',
    switch_to_side_by_side: 'Switch to side-by-side view',
    switch_to_replace: 'Switch to translation-only view',
    target_language: 'Target language',

    // Generic settings fields
    test: 'Test',
    function_assignments: 'Function Assignments',
    no_llm_configs: 'No LLM configurations yet',
    none_option: '— None —',
    field_name: 'Name',
    field_base_url: 'Base URL',
    field_api_key: 'API Key',
    field_model: 'Model',
    placeholder_name: 'My LLM Config',
    test_ok: 'OK',
    test_failed: 'Failed',
    connection_success: 'Connection successful',
    current_token_hint: 'Current token',
    error_name_required: 'Name is required',
    error_base_url_required: 'Base URL is required',
    error_base_url_https: 'Base URL must start with https://',
    error_api_key_required: 'API Key is required',
    error_model_required: 'Model name is required',
    error_repo_owner_required: 'Repository owner is required',
    error_repo_name_required: 'Repository name is required',
    error_branch_required: 'Branch is required',
    error_content_path_required: 'Content path is required',
    field_repo_owner: 'Repository Owner',
    field_repo_name: 'Repository Name',
    field_token: 'Personal Access Token',
    field_branch: 'Branch',
    field_content_path: 'Content Path',
    field_feed_url: 'Feed URL',
    field_subscription_title: 'Subscription name',
    error_title_required: 'Title is required',
    error_url_required: 'URL is required',
    error_url_too_long: 'URL exceeds 2048 characters',
    error_url_protocol: 'URL must start with http:// or https://',

    // OPML import
    choose_opml_file: 'Choose OPML File',
    opml_hint: 'Accepts .opml or .xml files (max 5MB)',
    importing_subscriptions: 'Importing subscriptions…',
    import_another: 'Import Another',
    file_too_large: 'File too large. Maximum size is 5MB.',
    invalid_file_type: 'Invalid file type. Please select an .opml or .xml file.',
    imported_count: 'Imported',
    skipped_count: 'Skipped',
    failed_count: 'Failed',

    // Pull to refresh
    pull_to_refresh: '↓ Pull to refresh',
    release_to_refresh: '↓ Release to refresh',
    refreshing: '⟳ Refreshing…',

    // TTS (read-aloud) configuration
    tts_config: 'Read Aloud (TTS)',
    settings_tts_desc: 'Configure the text-to-speech service URL, key and voice',
    field_tts_url: 'Service URL',
    field_tts_token: 'API Key',
    field_tts_voice: 'Voice',
    tts_voice_auto: 'Auto (by language)',
    tts_voice_auto_hint: 'Auto picks a voice from each paragraph\'s language; a manual choice reads the whole article in one voice',
    tts_voice_manual_hint: 'The whole article will be read in the selected voice, without switching by language',
    tts_voice_zh_cn: 'Mandarin (Mainland China)',
    tts_voice_zh_hk: 'Cantonese (Hong Kong, China)',
    tts_voice_zh_tw: 'Mandarin (Taiwan, China)',
    tts_voice_en: 'English',
    tts_voice_other: 'Other languages',
    tts_token_saved_hint: 'A key is saved; type to replace it',
    tts_save_success: 'TTS configuration saved',
    tts_test_success: 'TTS service connected',
    error_tts_url_protocol: 'Service URL must start with http(s)://',
  },
};

/** Current active language */
let currentLanguage: SupportedLanguage = 'en';

/** Registered language change listeners */
const listeners: Set<LanguageChangeListener> = new Set();

/** Mirror the active language onto `<html lang>`. Idempotent. */
function syncDocumentLanguage(lang: SupportedLanguage): void {
  if (typeof document === 'undefined') return;
  document.documentElement?.setAttribute('lang', lang);
}

/**
 * Initialize the i18n module. The interface is English-only.
 * The optional argument is accepted for compatibility and ignored.
 */
export function initI18n(navigatorLang?: string): void {
  currentLanguage = detectLanguage(navigatorLang ?? 'en');
  syncDocumentLanguage(currentLanguage);
}

/**
 * Get the translation for a given key in the current language.
 * Returns the key itself if no translation is found.
 */
export function t(key: string): string {
  const dict = translations[currentLanguage];
  return dict[key] ?? key;
}

/**
 * Switch the active language and notify listeners.
 * Only 'en' exists today; kept so more UI languages can be added later.
 */
export function setLanguage(lang: SupportedLanguage): void {
  syncDocumentLanguage(lang);
  if (lang === currentLanguage) return;
  currentLanguage = lang;
  for (const listener of listeners) {
    listener(lang);
  }
}

/**
 * Get the current active language.
 */
export function getLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * Register a callback to be notified when language changes.
 * Returns an unsubscribe function.
 */
export function onLanguageChange(listener: LanguageChangeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get all registered translation keys.
 */
export function getTranslationKeys(): string[] {
  return Object.keys(translations.en);
}
