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
  assert.deepEqual(url.searchParams.get('scope').split(' '), ['openid', 'email', scope]);
  const sheetsStart = flow.startOAuth(new NextRequest('https://certify.test/api/auth/gmail/connect?purpose=sheets'), 'user-a');
  assert.ok(new URL(sheetsStart.headers.get('location')).searchParams.get('scope').includes('spreadsheets.readonly'));
  for (const [key, value] of Object.entries({ access_type: 'offline', prompt: 'select_account consent', include_granted_scopes: 'true' })) {
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
  let callbackContext = { userId: 'user-a', redirectUri: 'https://certify.test/api/auth/gmail/callback' };
  const gmailCallback = load('app/api/auth/gmail/callback/route.ts', {
    'googleapis': { google: { auth: { OAuth2: class { constructor() { throw Error('Must not exchange a denied or mismatched callback'); } } } } },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'user-a' }) },
    '@/lib/db': { supabase: {} },
    '@/lib/appUrl': { getGoogleLoginConfig: () => ({ baseUrl: 'https://certify.test', redirectUri: callbackContext.redirectUri }), authCookieOptions: () => ({ path: '/' }) },
    '@/lib/authErrors': { authError: () => { throw Error('Unexpected callback failure'); } },
    '@/lib/oauthFlow': { readOAuthContext: () => callbackContext },
    '@/lib/gmail': { getGmailConnection: () => { throw Error('Unexpected token read'); } },
    '@/lib/oauth': { GMAIL_SEND_SCOPE: scope },
  });
  const denied = await gmailCallback.GET(new NextRequest('https://certify.test/api/auth/gmail/callback?error=access_denied'));
  assert.equal(denied.headers.get('location'), 'https://certify.test/?gmail=denied');
  assert.deepEqual(denied.cookies.getAll().map(c => c.name), ['gmail_oauth_state']); // Login cookies untouched.
  callbackContext = { ...callbackContext, userId: 'user-b' };
  const mismatch = await gmailCallback.GET(new NextRequest('https://certify.test/api/auth/gmail/callback?code=test'));
  assert.equal(mismatch.headers.get('location'), 'https://certify.test/?gmail=reconnect');
  console.log('PASS: minimum Gmail scopes, contextual Sheets permission, denied consent preserves login, cross-user callback rejected');
  let lookupError = null;
  const { getGmailConnection } = load('lib/gmail.ts', {
    './oauth': { GMAIL_SEND_SCOPE: scope },
    './db': { supabase: { from: table => {
      assert.equal(table, 'gmail_tokens');
      return { select: () => ({ eq: (key, id) => {
        assert.equal(key, 'user_id'); assert.equal(id, 'user-a');
        return { maybeSingle: async () => ({ data: null, error: lookupError }) };
      } }) };
    } } },
  });
  assert.equal(await getGmailConnection('user-a'), null);
  lookupError = { code: 'PGRST205' };
  await assert.rejects(getGmailConnection('user-a'), error =>
    error.code === 'GMAIL_SCHEMA_MISSING' && error.status === 503 && error.message.includes('supabase/gmail_tokens.sql'));
  lookupError = { code: '42501' };
  await assert.rejects(getGmailConnection('user-a'), error => error.code === 'TOKEN_LOOKUP_FAILED');
  console.log('PASS: verified Auth user, signed Gmail state, tamper rejection, offline consent, per-user token lookup');
})().catch(() => { console.error('FAIL: Supabase Auth regression checks'); process.exitCode = 1; });
