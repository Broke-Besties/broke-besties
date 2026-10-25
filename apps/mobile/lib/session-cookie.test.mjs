// Run: node --test lib/session-cookie.test.mjs (needs apps/web's node_modules for @supabase/ssr)
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { sessionCookie } from './session-cookie.ts';

const { createServerClient } = createRequire(new URL('../../web/package.json', import.meta.url))('@supabase/ssr');
const URL_ = 'https://abcdefgh.supabase.co';

// Parse the header the way the website's server does and return the session it sees.
async function serverSession(header) {
  const cookies = header.split('; ').map((pair) => {
    const i = pair.indexOf('=');
    return { name: pair.slice(0, i), value: pair.slice(i + 1) };
  });
  const client = createServerClient(URL_, 'anon', { cookies: { getAll: () => cookies, setAll() {} } });
  return (await client.auth.getSession()).data.session;
}

const session = (name) => ({
  access_token: 'a.b.c',
  refresh_token: 'r1',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'u1', email: 'x@y.z', user_metadata: { full_name: name } },
});

test('a small session round-trips in one cookie', async () => {
  const s = session('Zoë 🍕');
  const header = sessionCookie(URL_, s);
  assert.match(header, /^sb-abcdefgh-auth-token=base64-/);
  assert.deepEqual(await serverSession(header), s);
});

test('a large session round-trips across chunks', async () => {
  const s = session('Zoë '.repeat(2000));
  const header = sessionCookie(URL_, s);
  assert.match(header, /sb-abcdefgh-auth-token\.1=/);
  assert.deepEqual(await serverSession(header), s);
});
