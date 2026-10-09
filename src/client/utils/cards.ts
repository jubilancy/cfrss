/**
 * Small helpers for article cards (excerpt, thumbnail, relative time, favicon).
 * Shared by the tag, folder and library pages.
 */

import { t } from '../services/i18n.js';

export function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function firstImage(html: string): string {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

export function relativeTime(iso: string): string {
  // D1 stores "YYYY-MM-DD HH:MM:SS" in UTC; make it parseable as such.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(iso) ? `${iso.replace(' ', 'T')}Z` : iso;
  const ts = Date.parse(normalized);
  if (Number.isNaN(ts)) return '';
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return t('time_now');
  if (minutes < 60) return `${minutes} ${t('time_minutes')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${t('time_hours')}`;
  const days = Math.floor(hours / 24);
  return `${days} ${t('time_days')}`;
}

export function faviconFor(feedUrl: string): string {
  if (!feedUrl) return '';
  try {
    const host = new URL(feedUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  } catch {
    return '';
  }
}
