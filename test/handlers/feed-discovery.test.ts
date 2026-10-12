import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../src/index';
import { setupTestDatabase } from '../setup';
import type { Env } from '../../src/types';

const TEST_ENV: Env = {
  DB: null as unknown as D1Database,
  ENCRYPTION_KEY: 'test-encryption-key-32bytes-long!',
  AUTH_TOKEN: 'test-auth-token',
};

function post(body: unknown, auth = true) {
  return app.fetch(
    new Request('http://localhost/api/feeds/discover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Authorization: 'Bearer test-auth-token' } : {}),
      },
      body: JSON.stringify(body),
    }),
    TEST_ENV
  );
}

describe('POST /api/feeds/discover', () => {
  beforeEach(async () => {
    TEST_ENV.DB = env.DB;
    await setupTestDatabase(env.DB);
  });

  it('needs a login', async () => {
    expect((await post({ url: 'example.com' }, false)).status).toBe(401);
  });

  it('needs a url', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ url: '   ' })).status).toBe(400);
    expect((await post({ url: 'x'.repeat(2049) })).status).toBe(400);
  });

  it('explains instead of fetching a private address', async () => {
    const res = await post({ url: 'http://127.0.0.1/feed' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { candidates: unknown[]; notes: string[] };
    expect(body.candidates).toEqual([]);
    expect(body.notes[0]).toContain('private network');
  });
});
