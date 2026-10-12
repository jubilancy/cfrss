/**
 * PublicCollectionView — what a visitor sees at /TBR or /tag/cooking when the
 * folder or tag is public and they are not signed in. A calm reading page:
 * the name, how many articles, links to follow it, and the articles with
 * title, source, date and a short excerpt. Every title links to the original.
 */

import { t } from '../../services/i18n.js';

export interface PublicFeedItem {
  id?: string;
  url: string;
  title: string;
  summary?: string;
  date_published?: string;
  authors?: Array<{ name: string }>;
}

export interface PublicFeedData {
  title: string;
  description?: string;
  home_page_url?: string;
  feed_url?: string;
  icon?: string;
  items: PublicFeedItem[];
}

/** Address of the public JSON feed that backs a folder or tag page. */
export function publicFeedPath(pathname: string): string {
  return `${pathname.replace(/\/+$/, '')}/feed.json`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export class PublicCollectionView {
  private element: HTMLElement;

  constructor(container: HTMLElement, data: PublicFeedData, pathname: string, onSignIn: () => void) {
    this.element = document.createElement('main');
    this.element.className = 'public-page';
    container.appendChild(this.element);
    this.render(data, pathname, onSignIn);
  }

  destroy(): void {
    this.element.remove();
  }

  private render(data: PublicFeedData, pathname: string, onSignIn: () => void): void {
    document.title = data.title;
    this.advertiseFeed(pathname, data.title);

    const header = document.createElement('header');
    header.className = 'public-page__header';

    const title = document.createElement('h1');
    title.className = 'public-page__title';
    title.textContent = data.title;
    header.appendChild(title);

    if (data.description) {
      const desc = document.createElement('p');
      desc.className = 'public-page__description';
      desc.textContent = data.description;
      header.appendChild(desc);
    }

    const links = document.createElement('p');
    links.className = 'public-page__links';
    const feedBase = pathname.replace(/\/+$/, '');
    for (const [label, file] of [[t('public_feed_rss'), 'feed.xml'], [t('public_feed_json'), 'feed.json']]) {
      const a = document.createElement('a');
      a.href = `${feedBase}/${file}`;
      a.textContent = label;
      links.appendChild(a);
    }
    const signIn = document.createElement('button');
    signIn.type = 'button';
    signIn.className = 'public-page__signin';
    signIn.textContent = t('login_button');
    signIn.addEventListener('click', onSignIn);
    links.appendChild(signIn);
    header.appendChild(links);
    this.element.appendChild(header);

    const list = document.createElement('div');
    list.className = 'public-page__list';

    if (data.items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'public-page__empty';
      empty.textContent = t('collection_empty');
      list.appendChild(empty);
    }

    for (const item of data.items) {
      const card = document.createElement('article');
      card.className = 'public-card';

      const meta = document.createElement('div');
      meta.className = 'public-card__meta';
      const bits = [hostOf(item.url), item.authors?.[0]?.name ?? '', formatDate(item.date_published)].filter(Boolean);
      meta.textContent = bits.join(' · ');

      const heading = document.createElement('h2');
      heading.className = 'public-card__title';
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = item.title;
      heading.appendChild(link);

      card.appendChild(meta);
      card.appendChild(heading);

      if (item.summary) {
        const excerpt = document.createElement('p');
        excerpt.className = 'public-card__excerpt';
        excerpt.textContent = item.summary;
        card.appendChild(excerpt);
      }
      list.appendChild(card);
    }
    this.element.appendChild(list);

    const footer = document.createElement('footer');
    footer.className = 'public-page__footer';
    footer.textContent = t('public_page_footer');
    this.element.appendChild(footer);
  }

  /** Let browsers and readers discover the feed from the page. */
  private advertiseFeed(pathname: string, title: string): void {
    const base = pathname.replace(/\/+$/, '');
    document.head.querySelectorAll('link[data-public-feed]').forEach((el) => el.remove());
    const rss = document.createElement('link');
    rss.rel = 'alternate';
    rss.type = 'application/rss+xml';
    rss.title = title;
    rss.href = `${base}/feed.xml`;
    rss.setAttribute('data-public-feed', '');
    document.head.appendChild(rss);
  }
}
