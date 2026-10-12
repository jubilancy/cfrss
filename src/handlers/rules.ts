import type { Context } from 'hono';
import type { Env } from '../types';
import { applyRuleToExisting, createRule, deleteRule, listRules, updateRule, type RuleInput } from '../services/rules';
import { notFoundError, validationError } from '../utils/errors';

type Ctx = Context<{ Bindings: Env }>;

async function readBody(c: Ctx): Promise<RuleInput> {
  const body = await c.req.json<RuleInput>().catch(() => null);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Send the rule as a JSON object');
  }
  return body;
}

/** GET /api/rules */
export async function handleListRules(c: Ctx) {
  return c.json({ rules: await listRules(c.env.DB) });
}

/** POST /api/rules — create. Returns 201. */
export async function handleCreateRule(c: Ctx) {
  const rule = await createRule(c.env.DB, await readBody(c));
  return c.json({ rule }, 201);
}

/** PUT /api/rules/:id — change fields; fields not sent keep their value. */
export async function handleUpdateRule(c: Ctx) {
  const rule = await updateRule(c.env.DB, c.req.param('id')!, await readBody(c));
  return c.json({ rule });
}

/** DELETE /api/rules/:id */
export async function handleDeleteRule(c: Ctx) {
  const removed = await deleteRule(c.env.DB, c.req.param('id')!);
  if (!removed) throw notFoundError(`Rule not found: ${c.req.param('id')}`);
  return c.json({ success: true });
}

/** POST /api/rules/:id/apply — run the rule on existing articles. */
export async function handleApplyRule(c: Ctx) {
  return c.json(await applyRuleToExisting(c.env.DB, c.req.param('id')!));
}
