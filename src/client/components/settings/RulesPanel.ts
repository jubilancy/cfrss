/**
 * RulesPanel — create and manage rules in Settings.
 *
 * A rule watches new articles for a feed and/or a keyword, and can tag them,
 * file them in a folder, or mark them read. "Apply now" runs a rule on the
 * articles already stored.
 */

import {
  applyRule,
  createRule,
  deleteRule,
  getFolders,
  getRules,
  getSubscriptions,
  updateRule,
  type FolderInfo,
  type RuleInfo,
} from '../../services/api.js';
import { t } from '../../services/i18n.js';
import type { Subscription } from '../../../types/index.js';

export class RulesPanel {
  private element: HTMLElement;
  private rules: RuleInfo[] = [];
  private feeds: Subscription[] = [];
  private folders: FolderInfo[] = [];
  private loading = true;
  private message = '';
  private destroyed = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'rules-panel';
    this.render();
    void this.load();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  destroy(): void {
    this.destroyed = true;
  }

  private async load(): Promise<void> {
    try {
      [this.rules, this.feeds, this.folders] = await Promise.all([getRules(), getSubscriptions(), getFolders()]);
    } catch {
      this.message = t('rules_load_failed');
    }
    this.loading = false;
    if (!this.destroyed) this.render();
  }

  /** One sentence describing what a rule does. */
  private describe(rule: RuleInfo): string {
    const when: string[] = [];
    if (rule.feedId) {
      when.push(`${t('rules_from')} ${this.feeds.find((f) => f.id === rule.feedId)?.title ?? '?'}`);
    }
    if (rule.contains) {
      when.push(`${rule.matchField === 'title' ? t('rules_in_title') : t('rules_in_text')} “${rule.contains}”`);
    }
    const then: string[] = [];
    if (rule.addTag) then.push(`${t('rules_tag')} #${rule.addTag}`);
    if (rule.folderId) {
      then.push(`${t('rules_folder')} ${this.folders.find((f) => f.id === rule.folderId)?.name ?? '?'}`);
    }
    if (rule.markRead) then.push(t('rules_mark_read'));
    return `${when.join(' · ')} → ${then.join(' · ')}`;
  }

  private render(): void {
    this.element.innerHTML = '';

    const hint = document.createElement('p');
    hint.className = 'rules-panel__hint';
    hint.textContent = t('rules_hint');
    this.element.appendChild(hint);

    if (this.loading) {
      const p = document.createElement('p');
      p.textContent = t('loading');
      this.element.appendChild(p);
      return;
    }

    const list = document.createElement('div');
    list.className = 'rules-panel__list';
    if (this.rules.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'rules-panel__empty';
      empty.textContent = t('rules_empty');
      list.appendChild(empty);
    }
    for (const rule of this.rules) list.appendChild(this.renderRule(rule));
    this.element.appendChild(list);

    this.element.appendChild(this.renderForm());

    if (this.message) {
      const msg = document.createElement('p');
      msg.className = 'rules-panel__message';
      msg.setAttribute('role', 'status');
      msg.textContent = this.message;
      this.element.appendChild(msg);
    }
  }

  private renderRule(rule: RuleInfo): HTMLElement {
    const row = document.createElement('div');
    row.className = `rule-row${rule.enabled ? '' : ' rule-row--off'}`;

    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = rule.enabled;
    toggle.setAttribute('aria-label', t('rules_enabled'));
    toggle.addEventListener('change', () => {
      void this.run(async () => {
        const saved = await updateRule(rule.id, { enabled: toggle.checked });
        this.rules = this.rules.map((r) => (r.id === rule.id ? saved : r));
      });
    });

    const text = document.createElement('div');
    text.className = 'rule-row__text';
    if (rule.name) {
      const name = document.createElement('strong');
      name.textContent = rule.name;
      text.appendChild(name);
    }
    const sentence = document.createElement('span');
    sentence.textContent = this.describe(rule);
    text.appendChild(sentence);

    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'btn';
    apply.textContent = t('rules_apply_now');
    apply.addEventListener('click', () => {
      void this.run(async () => {
        const result = await applyRule(rule.id);
        this.message = `${t('rules_applied')}: ${result.matched} / ${result.checked}`;
      }, false);
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn';
    remove.textContent = t('delete');
    remove.addEventListener('click', () => {
      if (!window.confirm(t('rules_delete_confirm'))) return;
      void this.run(async () => {
        await deleteRule(rule.id);
        this.rules = this.rules.filter((r) => r.id !== rule.id);
      });
    });

    row.appendChild(toggle);
    row.appendChild(text);
    row.appendChild(apply);
    row.appendChild(remove);
    return row;
  }

  private renderForm(): HTMLElement {
    const form = document.createElement('form');
    form.className = 'rules-panel__form';

    const title = document.createElement('h4');
    title.textContent = t('rules_new');
    form.appendChild(title);

    const field = (label: string, control: Node): HTMLElement => {
      const wrap = document.createElement('label');
      wrap.className = 'rules-panel__field';
      const span = document.createElement('span');
      span.textContent = label;
      wrap.appendChild(span);
      wrap.appendChild(control);
      return wrap;
    };

    const feed = document.createElement('select');
    const anyFeed = document.createElement('option');
    anyFeed.value = '';
    anyFeed.textContent = t('rules_any_feed');
    feed.appendChild(anyFeed);
    for (const f of this.feeds) {
      const option = document.createElement('option');
      option.value = f.id;
      option.textContent = f.title;
      feed.appendChild(option);
    }

    const contains = document.createElement('input');
    contains.type = 'text';
    contains.maxLength = 100;
    contains.placeholder = t('rules_keyword_placeholder');

    const where = document.createElement('select');
    for (const [value, label] of [['title', t('rules_in_title')], ['any', t('rules_in_text')]]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      where.appendChild(option);
    }

    const tag = document.createElement('input');
    tag.type = 'text';
    tag.maxLength = 50;
    tag.placeholder = t('rules_tag_placeholder');

    const folder = document.createElement('select');
    const noFolder = document.createElement('option');
    noFolder.value = '';
    noFolder.textContent = t('rules_no_folder');
    folder.appendChild(noFolder);
    for (const f of this.folders) {
      const option = document.createElement('option');
      option.value = f.id;
      option.textContent = f.name;
      folder.appendChild(option);
    }

    const markRead = document.createElement('input');
    markRead.type = 'checkbox';

    const name = document.createElement('input');
    name.type = 'text';
    name.maxLength = 60;
    name.placeholder = t('rules_name_placeholder');

    const when = document.createElement('fieldset');
    const whenLegend = document.createElement('legend');
    whenLegend.textContent = t('rules_when');
    when.appendChild(whenLegend);
    when.appendChild(field(t('rules_feed'), feed));
    when.appendChild(field(t('rules_keyword'), contains));
    when.appendChild(field(t('rules_look_in'), where));

    const then = document.createElement('fieldset');
    const thenLegend = document.createElement('legend');
    thenLegend.textContent = t('rules_then');
    then.appendChild(thenLegend);
    then.appendChild(field(t('rules_tag'), tag));
    then.appendChild(field(t('rules_folder'), folder));
    then.appendChild(field(t('rules_mark_read'), markRead));

    form.appendChild(when);
    form.appendChild(then);
    form.appendChild(field(t('rules_name'), name));

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'btn btn--primary';
    submit.textContent = t('create');
    form.appendChild(submit);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.run(async () => {
        const saved = await createRule({
          name: name.value,
          feedId: feed.value || null,
          contains: contains.value || null,
          matchField: where.value === 'any' ? 'any' : 'title',
          addTag: tag.value || null,
          folderId: folder.value || null,
          markRead: markRead.checked,
        });
        this.rules = [...this.rules, saved];
      });
    });
    return form;
  }

  /** Run an action, then redraw. Shows the server's message when it fails. */
  private async run(action: () => Promise<void>, clearMessage = true): Promise<void> {
    if (clearMessage) this.message = '';
    try {
      await action();
    } catch (err) {
      this.message = err instanceof Error && err.message ? err.message : t('organize_failed');
    }
    if (!this.destroyed) this.render();
  }
}
