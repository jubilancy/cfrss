/**
 * LibraryView — /library: every folder and tag in one place, with a way to
 * create a folder. Links go to /TBR and /tag/cooking style pages.
 */

import { navigate, folderPath, tagPath } from '../../router.js';
import { createFolder, getFolders, getTags, type FolderInfo, type TagInfo } from '../../services/api.js';
import { t } from '../../services/i18n.js';

export interface LibraryViewOptions {
  container: HTMLElement;
}

export class LibraryView {
  private container: HTMLElement;
  private element: HTMLElement;
  private folders: FolderInfo[] = [];
  private tags: TagInfo[] = [];
  private loading = true;
  private error = '';
  private destroyed = false;

  constructor(options: LibraryViewOptions) {
    this.container = options.container;
    this.element = document.createElement('div');
    this.element.className = 'library-view';
    this.container.appendChild(this.element);
  }

  async init(): Promise<void> {
    this.render();
    try {
      const [folders, tags] = await Promise.all([getFolders(), getTags()]);
      this.folders = folders;
      this.tags = tags;
    } catch {
      this.error = t('load_collection_failed');
    } finally {
      this.loading = false;
      if (!this.destroyed) this.render();
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.element.remove();
  }

  private render(): void {
    this.element.innerHTML = '';

    const title = document.createElement('h2');
    title.className = 'library-view__title';
    title.textContent = t('library');
    this.element.appendChild(title);

    if (this.loading) {
      this.element.appendChild(this.textBlock(t('loading')));
      return;
    }
    if (this.error) {
      const err = this.textBlock(this.error);
      err.setAttribute('role', 'alert');
      this.element.appendChild(err);
      return;
    }

    // ---- Folders ----
    this.element.appendChild(this.heading(t('folders')));
    const folderList = document.createElement('div');
    folderList.className = 'library-view__list';
    if (this.folders.length === 0) {
      folderList.appendChild(this.textBlock(t('library_empty_folders')));
    }
    for (const folder of this.folders) {
      folderList.appendChild(this.link(folderPath(folder.slug), `📁 ${folder.name}`, folder.count));
    }
    this.element.appendChild(folderList);
    this.element.appendChild(this.newFolderForm());

    // ---- Tags ----
    this.element.appendChild(this.heading(t('tags')));
    const tagList = document.createElement('div');
    tagList.className = 'library-view__chips';
    if (this.tags.length === 0) {
      tagList.appendChild(this.textBlock(t('library_empty_tags')));
    }
    for (const tag of this.tags) {
      tagList.appendChild(this.link(tagPath(tag.slug), `# ${tag.name}`, tag.count, true));
    }
    this.element.appendChild(tagList);
  }

  private heading(text: string): HTMLElement {
    const h = document.createElement('h3');
    h.className = 'library-view__heading';
    h.textContent = text;
    return h;
  }

  private textBlock(text: string): HTMLElement {
    const p = document.createElement('p');
    p.className = 'library-view__text';
    p.textContent = text;
    return p;
  }

  private link(href: string, label: string, count: number, chip = false): HTMLAnchorElement {
    const a = document.createElement('a');
    a.href = href;
    a.className = chip ? 'library-chip' : 'library-link';
    const name = document.createElement('span');
    name.textContent = label;
    const n = document.createElement('span');
    n.className = 'library-count';
    n.textContent = String(count);
    a.append(name, n);
    return a;
  }

  private newFolderForm(): HTMLElement {
    const form = document.createElement('form');
    form.className = 'library-view__form';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 50;
    input.placeholder = t('new_folder_placeholder');
    input.setAttribute('aria-label', t('new_folder'));
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = t('create');
    form.append(input, btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      btn.disabled = true;
      createFolder(name)
        .then((folder) => navigate(folderPath(folder.slug)))
        .catch((err) => {
          btn.disabled = false;
          window.alert(err instanceof Error && err.message ? err.message : t('organize_failed'));
        });
    });
    return form;
  }
}
