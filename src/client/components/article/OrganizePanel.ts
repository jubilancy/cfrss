/**
 * OrganizePanel — add tags to an article and file it in folders.
 * Opened from the article toolbar's Organize button.
 */

import {
  addArticleTag,
  addArticleToFolder,
  createFolder,
  getArticleOrganization,
  getFolders,
  getTags,
  removeArticleFromFolder,
  removeArticleTag,
  type FolderInfo,
  type TagInfo,
} from '../../services/api.js';
import { folderPath, tagPath } from '../../router.js';
import { t } from '../../services/i18n.js';

export class OrganizePanel {
  private element: HTMLElement;
  private articleId: string;
  private articleTags: TagInfo[] = [];
  private inFolders = new Set<string>();
  private allFolders: FolderInfo[] = [];
  private knownTags: TagInfo[] = [];
  private message = '';
  private destroyed = false;

  constructor(host: HTMLElement, articleId: string) {
    this.articleId = articleId;
    this.element = document.createElement('div');
    this.element.className = 'organize-panel';
    host.appendChild(this.element);
    void this.load();
  }

  destroy(): void {
    this.destroyed = true;
    this.element.remove();
  }

  private async load(): Promise<void> {
    try {
      const [org, folders, tags] = await Promise.all([
        getArticleOrganization(this.articleId),
        getFolders(),
        getTags(),
      ]);
      this.articleTags = org.tags;
      this.inFolders = new Set(org.folders.map((f) => f.id));
      this.allFolders = folders;
      this.knownTags = tags;
    } catch {
      this.message = t('organize_failed');
    }
    if (!this.destroyed) this.render();
  }

  private render(): void {
    this.element.innerHTML = '';

    // ---- Tags ----
    const tagsSection = this.section(t('tags'));
    const chips = document.createElement('div');
    chips.className = 'organize-panel__chips';
    for (const tag of this.articleTags) {
      const chip = document.createElement('span');
      chip.className = 'organize-chip';
      const link = document.createElement('a');
      link.href = tagPath(tag.slug);
      link.textContent = `# ${tag.name}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.setAttribute('aria-label', `${t('remove_from_collection')}: ${tag.name}`);
      remove.textContent = '✕';
      remove.addEventListener('click', () => void this.removeTag(tag));
      chip.appendChild(link);
      chip.appendChild(remove);
      chips.appendChild(chip);
    }
    tagsSection.appendChild(chips);

    const listId = `organize-tags-${this.articleId}`;
    const datalist = document.createElement('datalist');
    datalist.id = listId;
    for (const tag of this.knownTags) {
      const option = document.createElement('option');
      option.value = tag.name;
      datalist.appendChild(option);
    }
    const tagForm = this.inlineForm(t('add_tag_placeholder'), t('add_tag'), (name) => this.addTag(name), listId);
    tagsSection.appendChild(datalist);
    tagsSection.appendChild(tagForm);
    this.element.appendChild(tagsSection);

    // ---- Folders ----
    const foldersSection = this.section(t('folders'));
    const list = document.createElement('div');
    list.className = 'organize-panel__folders';
    for (const folder of this.allFolders) {
      const label = document.createElement('label');
      label.className = 'organize-folder';
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = this.inFolders.has(folder.id);
      box.addEventListener('change', () => void this.toggleFolder(folder, box));
      const name = document.createElement('span');
      name.textContent = folder.name;
      const open = document.createElement('a');
      open.href = folderPath(folder.slug);
      open.className = 'organize-folder__open';
      open.textContent = '↗';
      open.setAttribute('aria-label', folder.name);
      label.appendChild(box);
      label.appendChild(name);
      label.appendChild(open);
      list.appendChild(label);
    }
    foldersSection.appendChild(list);
    foldersSection.appendChild(
      this.inlineForm(t('new_folder_placeholder'), t('create'), (name) => this.newFolder(name))
    );
    this.element.appendChild(foldersSection);

    if (this.message) {
      const msg = document.createElement('p');
      msg.className = 'organize-panel__message';
      msg.setAttribute('role', 'alert');
      msg.textContent = this.message;
      this.element.appendChild(msg);
    }
  }

  private section(title: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'organize-panel__section';
    const h = document.createElement('h4');
    h.textContent = title;
    section.appendChild(h);
    return section;
  }

  private inlineForm(
    placeholder: string,
    buttonLabel: string,
    onSubmit: (name: string) => Promise<void>,
    listId?: string
  ): HTMLElement {
    const form = document.createElement('form');
    form.className = 'organize-panel__form';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 50;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', placeholder);
    if (listId) input.setAttribute('list', listId);
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.textContent = buttonLabel;
    form.appendChild(input);
    form.appendChild(btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim();
      if (!name) return;
      btn.disabled = true;
      onSubmit(name).finally(() => {
        btn.disabled = false;
      });
    });
    return form;
  }

  private fail(err: unknown): void {
    this.message = err instanceof Error && err.message ? err.message : t('organize_failed');
    if (!this.destroyed) this.render();
  }

  private async addTag(name: string): Promise<void> {
    try {
      const tag = await addArticleTag(this.articleId, name);
      if (!this.articleTags.some((x) => x.id === tag.id)) this.articleTags.push(tag);
      if (!this.knownTags.some((x) => x.id === tag.id)) this.knownTags.push(tag);
      this.message = '';
      if (!this.destroyed) this.render();
    } catch (err) {
      this.fail(err);
    }
  }

  private async removeTag(tag: TagInfo): Promise<void> {
    try {
      await removeArticleTag(this.articleId, tag.id);
      this.articleTags = this.articleTags.filter((x) => x.id !== tag.id);
      this.message = '';
      if (!this.destroyed) this.render();
    } catch (err) {
      this.fail(err);
    }
  }

  private async toggleFolder(folder: FolderInfo, box: HTMLInputElement): Promise<void> {
    const wantIn = box.checked;
    try {
      if (wantIn) {
        await addArticleToFolder(folder.id, this.articleId);
        this.inFolders.add(folder.id);
      } else {
        await removeArticleFromFolder(folder.id, this.articleId);
        this.inFolders.delete(folder.id);
      }
      this.message = '';
    } catch (err) {
      box.checked = !wantIn;
      this.fail(err);
    }
  }

  private async newFolder(name: string): Promise<void> {
    try {
      const folder = await createFolder(name);
      await addArticleToFolder(folder.id, this.articleId);
      this.allFolders.push(folder);
      this.inFolders.add(folder.id);
      this.message = '';
      if (!this.destroyed) this.render();
    } catch (err) {
      this.fail(err);
    }
  }
}
