const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { NextRequest } = require('next/server');
function load(path, mocks) {
  const mod = new Module(path);
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, path);
  return mod.exports;
}
const scope = 'https://www.googleapis.com/auth/gmail.send';
process.env.SUPABASE_SERVICE_KEY = 'test-only-key';
const flow = load('lib/oauthFlow.ts', {
  './appUrl': { authCookieOptions: () => ({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
    getGoogleLoginConfig: () => ({ clientId: 'test-client', redirectUri: 'https://certify.test/api/auth/gmail/callback' }) },
  './authErrors': { requireEnv: () => {} }, './oauth': { GMAIL_SEND_SCOPE: scope },
});
(async () => {
  let authResult = { data: { user: { id: 'user-a' } }, error: null };
  const auth = load('lib/auth.ts', { 'server-only': {}, './supabase/server': {
    createClient: () => ({ auth: { getUser: async () => authResult } }),
  } });
  assert.equal((await auth.getCurrentUser()).id, 'user-a');
  authResult = { data: { user: null }, error: { status: 401 } };
  assert.equal(await auth.getCurrentUser(), null);
  authResult = { data: { user: null }, error: { status: 503 } };
  await assert.rejects(auth.getCurrentUser(), /unavailable/);
  const start = flow.startOAuth(new NextRequest('https://certify.test/api/auth/gmail/connect'), 'user-a');
  const url = new URL(start.headers.get('location'));
  assert.ok(url.searchParams.get('scope').split(' ').includes(scope));
  for (const [key, value] of Object.entries({ access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' })) {
    assert.equal(url.searchParams.get(key), value);
  }
  const cookie = start.cookies.get('gmail_oauth_state').value;
  const req = state => new NextRequest(`https://certify.test/api/auth/gmail/callback?state=${state}`, {
    headers: { cookie: `gmail_oauth_state=${cookie}` },
  });
  assert.equal(flow.readOAuthContext(req(url.searchParams.get('state'))).userId, 'user-a');
  assert.equal(flow.readOAuthContext(req('wrong-state')), null);
  const forged = new NextRequest(`https://certify.test/api/auth/gmail/callback?state=${url.searchParams.get('state')}`, {
    headers: { cookie: `gmail_oauth_state=x${cookie}` },
  });
  assert.equal(flow.readOAuthContext(forged), null);
  const { getGmailConnection } = load('lib/gmail.ts', {
    './oauth': { GMAIL_SEND_SCOPE: scope },
    './db': { supabase: { from: table => {
      assert.equal(table, 'gmail_tokens');
      return { select: () => ({ eq: (key, id) => {
        assert.equal(key, 'user_id'); assert.equal(id, 'user-a');
        return { maybeSingle: async () => ({ data: null, error: null }) };
      } }) };
    } } },
  });
  assert.equal(await getGmailConnection('user-a'), null);
  console.log('PASS: verified Auth user, signed Gmail state, tamper rejection, offline consent, per-user token lookup');
})().catch(() => { console.error('FAIL: Supabase Auth regression checks'); process.exitCode = 1; });
