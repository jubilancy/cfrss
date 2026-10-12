/**
 * AddSubscription — Form component for adding a new RSS/Atom feed subscription.
 * Input field for Feed URL (max 2048 chars), category dropdown, and submit button.
 * Shows loading state while validating/probing and error messages from API.
 *
 * Requirements: 5.1, 5.5, 5.6, 5.7
 */

import { t } from '../../services/i18n.js';
import type { Category } from '../../../types/index.js';

interface FoundFeed {
  url: string;
  title: string;
  source: 'direct' | 'page' | 'known' | 'guess';
  verified: boolean;
}

export class AddSubscription {
  private element: HTMLElement;
  private categories: Category[];
  private onAdded: () => void;
  private loading = false;
  private error: string | null = null;
  private urlValue = '';
  private categoryValue = 'default';

  // Feed finder state
  private finderValue = '';
  private finderLoading = false;
  private finderResults: FoundFeed[] | null = null;
  private finderNotes: string[] = [];

  constructor(categories: Category[], onAdded: () => void) {
    this.categories = categories;
    this.onAdded = onAdded;
    this.element = document.createElement('div');
    this.element.className = 'add-subscription';
    this.render();
  }

  /**
   * Get the rendered DOM element.
   */
  getElement(): HTMLElement {
    return this.element;
  }

  /**
   * Look up feeds for any website, channel or profile address.
   */
  private async find(): Promise<void> {
    const text = this.finderValue.trim();
    if (!text) return;

    this.finderLoading = true;
    this.finderResults = null;
    this.finderNotes = [];
    this.render();

    try {
      const res = await fetch('/api/feeds/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(body?.message || `Error: ${res.status}`);
      }
      const data = (await res.json()) as { candidates: FoundFeed[]; notes: string[] };
      this.finderResults = data.candidates;
      this.finderNotes = data.notes;
    } catch (err) {
      this.finderResults = [];
      this.finderNotes = [err instanceof Error ? err.message : t('network_error')];
    } finally {
      this.finderLoading = false;
      this.render();
    }
  }

  /**
   * Subscribe to one of the found feeds with the normal add flow.
   */
  private addFound(feed: FoundFeed): void {
    this.urlValue = feed.url;
    void this.submit().then(() => {
      if (!this.error) {
        this.finderResults = null;
        this.finderValue = '';
        this.render();
      }
    });
  }

  /**
   * Submit the form — calls POST /api/subscriptions.
   */
  private async submit(): Promise<void> {
    const url = this.urlValue.trim();

    // Client-side validation
    if (!url) {
      this.error = t('validation_error') + ': ' + t('error_url_required');
      this.render();
      return;
    }

    if (url.length > 2048) {
      this.error = t('validation_error') + ': ' + t('error_url_too_long');
      this.render();
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      this.error = t('validation_error') + ': ' + t('error_url_protocol');
      this.render();
      return;
    }

    this.loading = true;
    this.error = null;
    this.render();

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          categoryId: this.categoryValue,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null;
        const message = body?.message || `Error: ${res.status}`;
        throw new Error(message);
      }

      // Success — notify parent
      this.urlValue = '';
      this.categoryValue = 'default';
      this.onAdded();
    } catch (err) {
      this.error = err instanceof Error ? err.message : t('network_error');
    } finally {
      this.loading = false;
      this.render();
    }
  }

  /**
   * The feed finder: type any address, get feeds to pick from.
   */
  private renderFinder(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'feed-finder';

    const title = document.createElement('h3');
    title.className = 'feed-finder__title';
    title.textContent = t('find_feed');
    box.appendChild(title);

    const hint = document.createElement('p');
    hint.className = 'feed-finder__hint';
    hint.textContent = t('find_feed_hint');
    box.appendChild(hint);

    const row = document.createElement('form');
    row.className = 'feed-finder__row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'add-subscription__input';
    input.placeholder = t('find_feed_placeholder');
    input.maxLength = 2048;
    input.value = this.finderValue;
    input.disabled = this.finderLoading;
    input.setAttribute('aria-label', t('find_feed'));
    input.addEventListener('input', (e) => {
      this.finderValue = (e.target as HTMLInputElement).value;
    });
    const button = document.createElement('button');
    button.type = 'submit';
    button.className = 'btn btn--primary';
    button.disabled = this.finderLoading;
    button.textContent = this.finderLoading ? t('loading') : t('find');
    row.appendChild(input);
    row.appendChild(button);
    row.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.find();
    });
    box.appendChild(row);

    for (const note of this.finderNotes) {
      const p = document.createElement('p');
      p.className = 'feed-finder__note';
      p.textContent = note;
      box.appendChild(p);
    }

    if (this.finderResults && this.finderResults.length > 0) {
      const list = document.createElement('div');
      list.className = 'feed-finder__results';
      for (const feed of this.finderResults) {
        const item = document.createElement('div');
        item.className = 'feed-finder__result';

        const text = document.createElement('div');
        text.className = 'feed-finder__text';
        const name = document.createElement('strong');
        name.textContent = feed.title;
        const url = document.createElement('span');
        url.className = 'feed-finder__url';
        url.textContent = feed.url;
        text.appendChild(name);
        text.appendChild(url);
        if (!feed.verified) {
          const warn = document.createElement('span');
          warn.className = 'feed-finder__unverified';
          warn.textContent = t('find_feed_unverified');
          text.appendChild(warn);
        }

        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn';
        add.disabled = this.loading;
        add.textContent = t('add');
        add.addEventListener('click', () => this.addFound(feed));

        item.appendChild(text);
        item.appendChild(add);
        list.appendChild(item);
      }
      box.appendChild(list);
    }

    return box;
  }

  /**
   * Render the form.
   */
  private render(): void {
    this.element.innerHTML = '';

    this.element.appendChild(this.renderFinder());

    const form = document.createElement('form');
    form.className = 'add-subscription__form';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit();
    });

    // URL input
    const urlGroup = document.createElement('div');
    urlGroup.className = 'add-subscription__field';

    const urlLabel = document.createElement('label');
    urlLabel.className = 'add-subscription__label';
    urlLabel.textContent = t('field_feed_url');
    urlLabel.setAttribute('for', 'add-sub-url');
    urlGroup.appendChild(urlLabel);

    const urlInput = document.createElement('input');
    urlInput.className = 'add-subscription__input';
    urlInput.type = 'url';
    urlInput.id = 'add-sub-url';
    urlInput.placeholder = 'https://example.com/feed.xml';
    urlInput.maxLength = 2048;
    urlInput.value = this.urlValue;
    urlInput.disabled = this.loading;
    urlInput.required = true;
    urlInput.addEventListener('input', (e) => {
      this.urlValue = (e.target as HTMLInputElement).value;
    });
    urlGroup.appendChild(urlInput);

    form.appendChild(urlGroup);

    // Category selector
    const catGroup = document.createElement('div');
    catGroup.className = 'add-subscription__field';

    const catLabel = document.createElement('label');
    catLabel.className = 'add-subscription__label';
    catLabel.textContent = t('move_to_category');
    catLabel.setAttribute('for', 'add-sub-category');
    catGroup.appendChild(catLabel);

    const catSelect = document.createElement('select');
    catSelect.className = 'add-subscription__select';
    catSelect.id = 'add-sub-category';
    catSelect.disabled = this.loading;
    catSelect.addEventListener('change', (e) => {
      this.categoryValue = (e.target as HTMLSelectElement).value;
    });

    for (const cat of this.categories) {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      option.selected = cat.id === this.categoryValue;
      catSelect.appendChild(option);
    }

    catGroup.appendChild(catSelect);
    form.appendChild(catGroup);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn--primary add-subscription__submit';
    submitBtn.type = 'submit';
    submitBtn.disabled = this.loading;
    submitBtn.style.minWidth = '44px';
    submitBtn.style.minHeight = '44px';
    submitBtn.textContent = this.loading ? t('generating') : t('add');
    form.appendChild(submitBtn);

    this.element.appendChild(form);

    // Error display
    if (this.error) {
      const errorEl = document.createElement('div');
      errorEl.className = 'add-subscription__error';
      errorEl.setAttribute('role', 'alert');
      errorEl.textContent = this.error;
      this.element.appendChild(errorEl);
    }

    // Loading indicator
    if (this.loading) {
      const loadingEl = document.createElement('div');
      loadingEl.className = 'add-subscription__loading';
      loadingEl.setAttribute('aria-live', 'polite');
      loadingEl.textContent = t('generating');
      this.element.appendChild(loadingEl);
    }
  }
}
