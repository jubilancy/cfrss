import { describe, it, expect } from 'vitest';
import { normalizeRuleInput, ruleMatches } from '../../src/services/rules';

const article = { id: 'a1', feedId: 'f1', title: 'Best Pasta Recipes', summary: '<p>Easy <b>dinner</b> ideas</p>' };

describe('normalizeRuleInput', () => {
  it('accepts a keyword rule with a tag', () => {
    const rule = normalizeRuleInput({ contains: ' pasta ', addTag: 'food' });
    expect(rule).toMatchObject({ contains: 'pasta', addTag: 'food', matchField: 'title', enabled: true, markRead: false });
  });

  it('requires a condition', () => {
    expect(() => normalizeRuleInput({ addTag: 'food' })).toThrow();
  });

  it('requires an action', () => {
    expect(() => normalizeRuleInput({ feedId: 'f1' })).toThrow();
  });

  it('rejects a bad matchField and a symbol-only tag', () => {
    expect(() => normalizeRuleInput({ contains: 'x', markRead: true, matchField: 'body' })).toThrow();
    expect(() => normalizeRuleInput({ contains: 'x', addTag: '!!!' })).toThrow();
  });

  it('accepts markRead as the only action', () => {
    expect(normalizeRuleInput({ feedId: 'f1', markRead: true }).markRead).toBe(true);
  });
});

describe('ruleMatches', () => {
  it('matches on feed alone', () => {
    expect(ruleMatches({ feedId: 'f1', matchField: 'title', contains: null }, article)).toBe(true);
    expect(ruleMatches({ feedId: 'f2', matchField: 'title', contains: null }, article)).toBe(false);
  });

  it('matches keywords ignoring case', () => {
    expect(ruleMatches({ feedId: null, matchField: 'title', contains: 'PASTA' }, article)).toBe(true);
  });

  it('only searches the summary when matchField is any, ignoring tags', () => {
    expect(ruleMatches({ feedId: null, matchField: 'title', contains: 'dinner' }, article)).toBe(false);
    expect(ruleMatches({ feedId: null, matchField: 'any', contains: 'dinner' }, article)).toBe(true);
    expect(ruleMatches({ feedId: null, matchField: 'any', contains: '<b>' }, article)).toBe(false);
  });

  it('requires every condition', () => {
    expect(ruleMatches({ feedId: 'f2', matchField: 'title', contains: 'pasta' }, article)).toBe(false);
  });
});
