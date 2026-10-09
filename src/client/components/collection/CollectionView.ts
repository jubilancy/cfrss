/**
 * CollectionView — one tag page (/tag/cooking) or one folder page (/TBR).
 *
 * Lists the articles in the tag or folder, newest added first, using the same
 * card language as the bookmarks page. A card's "take out" button removes the
 * article from this tag or folder. Folders can also be renamed or deleted.
 */

import { navigate, folderPath } from '../../router.js';
import {
  getFolderArticles,
  getTagArticles,
  getSubscriptions,
  ApiError,
  removeArticleFromFolder,
  removeArticleTag,
  renameFolder,
  deleteFolder,
  type CollectionArticleInfo,
  type FolderInfo,
  type TagInfo,
} from '../../services/api.js';
import { t } from '../../services/i18n.js';
import { faviconFor, firstImage, relativeTime, stripHtml } from '../../utils/cards.js';
import type { Subscription } from '../../../types/index.js';

export interface CollectionViewOptions {
  container: HTMLElement;
  kind: 'tag' | 'folder';
  slug: string;
}

export class CollectionView {
  private container: HTMLElement;
  private element: HTMLElement;
  private kind: 'tag' | 'folder';
  private slug: string;
  private collection: TagInfo | FolderInfo | null = null;
  private articles: CollectionArticleInfo[] = [];
  private feeds: Subscription[] = [];
  private loading = true;
  private loadError = false;
  private notFound = false;
  private destroyed = false;

  constructor(options: CollectionViewOptions) {
    this.container = options.container;
    this.kind = options.kind;
    this.slug = options.slug;
    this.element = document.createElement('div');
    this.element.className = 'bookmarks-view collection-view';
    this.container.appendChild(this.element);
  }

  async init(): Promise<void> {
    this.render();
    try {
      this.feeds = await getSubscriptions();
    } catch {
      // Feed names are cosmetic
    }
    await this.load();
  }

  destroy(): void {
    this.destroyed = true;
    this.element.remove();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.loadError = false;
    this.notFound = false;
    try {
      if (this.kind === 'tag') {
        const data = await getTagArticles(this.slug);
        this.collection = data.tag;
        this.articles = data.articles;
      } else {
        const data = await getFolderArticles(this.slug);
        this.collection = data.folder;
        this.articles = data.articles;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        this.notFound = true;
      } else {
        this.loadError = true;
      }
    } finally {
      this.loading = false;
      if (!this.destroyed) this.render();
    }
  }

  private feedOf(id: string): Subscription | undefined {
    return this.feeds.find((f) => f.id === id);
  }

  private render(): void {
    this.element.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'bookmarks-view__header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'bookmarks-view__title-wrap';

    const title = document.createElement('h2');
    title.className = 'bookmarks-view__title';
    const prefix = this.kind === 'tag' ? '# ' : '';
    title.textContent = this.collection ? `${prefix}${this.collection.name}` : `${prefix}${this.slug}`;
    titleWrap.appendChild(title);

    if (this.collection) {
      const count = document.createElement('span');
      count.className = 'bookmarks-view__count';
      count.textContent = String(this.articles.length);
      titleWrap.appendChild(count);
    }
    header.appendChild(titleWrap);

    if (this.kind === 'folder' && this.collection) {
      const tools = document.createElement('div');
      tools.className = 'collection-view__tools';
      tools.appendChild(this.makeToolButton(t('rename_folder_prompt'), '✎', () => void this.rename()));
      tools.appendChild(this.makeToolButton(t('delete_folder'), '🗑', () => void this.remove()));
      header.appendChild(tools);
    }
    this.element.appendChild(header);

    const scroll = document.createElement('div');
    scroll.className = 'bookmarks-view__scroll';
    const list = document.createElement('div');
    list.className = 'bookmarks-view__list';
    scroll.appendChild(list);
    this.element.appendChild(scroll);

    if (this.loading) {
      list.innerHTML = `<div class="bookmarks-view__loading">${t('loading')}</div>`;
      return;
    }
    if (this.notFound) {
      list.innerHTML = `<div class="bookmarks-view__empty"><p class="bookmarks-view__empty-title">${t('collection_not_found')}</p></div>`;
      return;
    }
    if (this.loadError) {
      const error = document.createElement('div');
      error.className = 'bookmarks-view__error';
      error.setAttribute('role', 'alert');
      error.textContent = t('load_collection_failed');
      list.appendChild(error);
      return;
    }
    if (this.articles.length === 0) {
      list.innerHTML = `<div class="bookmarks-view__empty">
        <p class="bookmarks-view__empty-title">${t('collection_empty')}</p>
        <p class="bookmarks-view__empty-hint">${t('collection_empty_hint')}</p></div>`;
      return;
    }
    for (const article of this.articles) {
      list.appendChild(this.renderCard(article));
    }
  }

  private makeToolButton(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bookmarks-view__refresh';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.textContent = glyph;
    btn.addEventListener('click', onClick);
    return btn;
  }

  private renderCard(article: CollectionArticleInfo): HTMLElement {
    const feed = this.feedOf(article.subscriptionId);
    const card = document.createElement('article');
    card.className = 'bookmark-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');

    const textWrap = document.createElement('div');
    textWrap.className = 'bookmark-card__text';

    const source = document.createElement('div');
    source.className = 'bookmark-card__source';
    const favicon = faviconFor(feed?.url ?? '');
    if (favicon) {
      const img = document.createElement('img');
      img.className = 'bookmark-card__favicon';
      img.src = favicon;
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => img.remove();
      source.appendChild(img);
    }
    const feedName = document.createElement('span');
    feedName.className = 'bookmark-card__feed';
    feedName.textContent = feed?.title ?? t('articles');
    source.appendChild(feedName);
    const sep = document.createElement('span');
    sep.className = 'bookmark-card__sep';
    sep.textContent = '·';
    source.appendChild(sep);
    const added = document.createElement('time');
    added.className = 'bookmark-card__time';
    added.textContent = `${t('added_to_list')} ${relativeTime(article.addedAt)}`;
    source.appendChild(added);

    const title = document.createElement('h3');
    title.className = 'bookmark-card__title';
    title.textContent = article.title;

    const excerpt = document.createElement('p');
    excerpt.className = 'bookmark-card__excerpt';
    excerpt.textContent = stripHtml(article.summary || '').slice(0, 140);

    textWrap.appendChild(source);

    textWrap.appendChild(title);

    textWrap.appendChild(excerpt);
    card.appendChild(textWrap);

    const thumbSrc = firstImage(article.summary || '');
    if (thumbSrc) {
      const thumb = document.createElement('img');
      thumb.className = 'bookmark-card__thumb';
      thumb.src = thumbSrc;
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.onerror = () => {
        thumb.remove();
        card.classList.add('bookmark-card--no-thumb');
      };
      card.appendChild(thumb);
    } else {
      card.classList.add('bookmark-card--no-thumb');
    }

    const takeOut = document.createElement('button');
    takeOut.type = 'button';
    takeOut.className = 'bookmark-card__remove';
    takeOut.title = t('remove_from_collection');
    takeOut.setAttribute('aria-label', t('remove_from_collection'));
    takeOut.textContent = '✕';
    takeOut.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.takeOut(article, card);
    });
    card.appendChild(takeOut);

    const open = () => navigate(`/articles/${article.id}`);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    return card;
  }

  /** Remove one article from this tag or folder. Rolls back on failure. */
  private async takeOut(article: CollectionArticleInfo, card: HTMLElement): Promise<void> {
    if (!this.collection) return;
    const index = this.articles.indexOf(article);
    if (index === -1) return;
    this.articles.splice(index, 1);
    card.remove();
    if (this.articles.length === 0) this.render();
    try {
      if (this.kind === 'tag') {
        await removeArticleTag(article.id, this.collection.id);
      } else {
        await removeArticleFromFolder(this.collection.id, article.id);
      }
    } catch {
      this.articles.splice(Math.min(index, this.articles.length), 0, article);
      this.render();
    }
  }

  private async rename(): Promise<void> {
    if (this.kind !== 'folder' || !this.collection) return;
    const next = window.prompt(t('rename_folder_prompt'), this.collection.name);
    if (!next || next.trim() === '' || next.trim() === this.collection.name) return;
    try {
      const folder = await renameFolder(this.collection.id, next);
      // The address changes with the name, so move to the new one.
      navigate(folderPath(folder.slug));
    } catch {
      window.alert(t('organize_failed'));
    }
  }

  private async remove(): Promise<void> {
    if (this.kind !== 'folder' || !this.collection) return;
    if (!window.confirm(t('delete_folder_confirm'))) return;
    try {
      await deleteFolder(this.collection.id);
      navigate('/library');
    } catch {
      window.alert(t('organize_failed'));
    }
  }
}
