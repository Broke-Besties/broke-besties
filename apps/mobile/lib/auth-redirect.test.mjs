// Run: node --test lib/auth-redirect.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { tokensFromRedirect } from './auth-redirect.ts';

test('reads the session from the fragment', () => {
  assert.deepEqual(
    tokensFromRedirect('exp://10.0.0.5:8081/--/auth/callback#access_token=a.b.c&refresh_token=r1&token_type=bearer'),
    { access_token: 'a.b.c', refresh_token: 'r1' }
  );
  assert.deepEqual(tokensFromRedirect('mobile://auth/callback#access_token=x&refresh_token=y'), {
    access_token: 'x',
    refresh_token: 'y',
  });
});

test("throws Supabase's error from the query or the fragment", () => {
  assert.throws(
    () => tokensFromRedirect('mobile://auth/callback?error=access_denied&error_description=User+cancelled'),
    /User cancelled/
  );
  assert.throws(() => tokensFromRedirect('mobile://auth/callback#error_description=Bad%20state'), /Bad state/);
  assert.throws(() => tokensFromRedirect('mobile://auth/callback'), /did not finish/);
});
