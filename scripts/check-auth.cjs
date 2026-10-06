const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { NextRequest } = require('next/server');
const jwt = require('jsonwebtoken');

// Isolated auth regression checks: no real credentials or external writes.
const previousEnv = { ...process.env };
Object.assign(process.env, { NODE_ENV: 'production', APP_URL: 'https://certify.test', JWT_SECRET: 'test-signing-key-only', SUPABASE_URL: 'https://database.test', SUPABASE_SERVICE_KEY: 'test-service-key', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret' });
delete process.env.GOOGLE_REDIRECT_URI;
delete process.env.RESEND_API_KEY;
const cache = new Map();
let rows = [], cookie = '', databaseError = false, exchangeRedirect = '', grantedScopes = 'openid email profile';
const updates = [];
class Query {
  select() { return this; }
  returns() { return this; }
  ilike(key, value) { const literal = value.replace(/\\([\\%_])/g, '$1'); this.filter = row => row[key]?.toLowerCase() === literal.toLowerCase(); return this; }
  eq(key, value) { this.filter = row => row[key] === value; return this; }
  insert(value) { this.insertValue = value; return this; }
  update(value) { this.updateValue = value; return this; }
  async maybeSingle() {
    if (databaseError) return { data: null, error: { code: '42703' } };
    if (this.insertValue) {
      const row = { id: `user-${rows.length + 1}`, ...this.insertValue }; rows.push(row); return { data: row, error: null };
    }
    const row = rows.find(this.filter || (() => true));
    if (row && this.updateValue) { updates.push({ id: row.id, ...this.updateValue }); Object.assign(row, this.updateValue); }
    return { data: row || null, error: null };
  }
  single() { return this.maybeSingle(); }
  then(resolve, reject) { return this.maybeSingle().then(resolve, reject); }
}
class OAuth2 {
  constructor(_id, _secret, redirect) { exchangeRedirect = redirect; this.transporter = { defaults: {} }; }
  async getToken() { return { tokens: { access_token: 'test-access', refresh_token: 'test-refresh', expiry_date: Date.now() + 3600000, scope: grantedScopes } }; }
  setCredentials() {}
}
function load(name) {
  const filename = path.resolve(name);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.require = dependency => {
    if (dependency === 'next/headers') return { cookies: () => ({ get: name => name === 'session' && cookie ? { value: cookie } : undefined }), headers: () => new Headers() };
    if (dependency === 'googleapis') return { google: { auth: { OAuth2 }, oauth2: () => ({ userinfo: { get: async () => ({ data: { email: 'Google@Example.com', verified_email: true } }) } }) } };
    if (dependency === '@/lib/db' || dependency === './db') return { supabase: { from: () => new Query() } };
    if (dependency === '@/lib/rateLimit') return { checkRateLimit: () => true, getClientKey: () => 'test' };
    if (dependency === '@/lib/email') return { sendPasswordResetEmail: async () => ({ error: { statusCode: 403, message: 'Testing emails only' } }) };
    if (dependency.startsWith('@/')) return load(dependency.replace('@/', '') + '.ts');
    if (dependency.startsWith('.')) return load(path.join(path.dirname(filename), dependency + '.ts'));
    return require(dependency);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const request = (url, body, cookies = '') => new NextRequest(`https://certify.test${url}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookies ? { cookie: cookies } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const loggedErrors = [];
const previousError = console.error;
console.error = (...args) => loggedErrors.push(args.join(' '));
(async () => {
  const register = load('app/api/auth/register/route.ts').POST;
  const login = load('app/api/auth/login/route.ts').POST;
  const auth = load('lib/auth.ts');
  const urls = load('lib/appUrl.ts');
  const flow = load('lib/oauthFlow.ts');
  assert.equal(urls.getAppUrl(request('/')), 'https://certify.test');
  process.env.APP_URL = ' "https://certify.test/" ';
  assert.equal(urls.getAppUrl(request('/')), 'https://certify.test');
  delete process.env.APP_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'production.test';
  assert.equal(urls.getAppUrl({ headers: new Headers({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'proxy.test' }) }), 'https://proxy.test');
  assert.equal(urls.getAppUrl({ headers: new Headers({ host: 'ignored.test' }) }), 'https://production.test');
  process.env.APP_URL = 'https://certify.test';
  delete process.env.JWT_SECRET;
  assert.equal((await register(request('/api/auth/register', { email: 'a@example.com', password: 'password123' }))).status, 500);
  assert.equal(rows.length, 0);
  process.env.JWT_SECRET = 'test-signing-key-only';
  assert.equal((await register(request('/api/auth/register', { email: 'bad', password: 'short' }))).status, 400);
  let response = await register(request('/api/auth/register', { email: ' Person@Example.com ', password: 'password123' }));
  assert.equal(response.status, 200);
  assert.equal(rows[0].email, 'person@example.com');
  assert.match(rows[0].password_hash, /^\$2/);
  assert(await auth.verifyPassword('password123', rows[0].password_hash));
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/', 'Max-Age=2592000']) assert(response.headers.get('set-cookie').includes(flag));
  assert(!response.headers.get('set-cookie').includes('Domain='));
  assert.equal((await register(request('/api/auth/register', { email: 'PERSON@example.com', password: 'password123' }))).status, 409);
  assert.equal((await login(request('/api/auth/login', { email: 'person@example.com', password: 'wrong-password' }))).status, 401);
  assert.equal((await login(request('/api/auth/login', { email: 'PERSON@example.com', password: 'password123' }))).status, 200);
  const forgot = await load('app/api/auth/forgot-password/route.ts').POST(request('/api/auth/forgot-password', { email: 'person@example.com' }));
  // Missing API key must name the variable; provider 403 must have a readable error.
  assert.equal(forgot.status, 500);
  process.env.RESEND_API_KEY = 'test-resend-key';
  const rejectedReset = await load('app/api/auth/forgot-password/route.ts').POST(request('/api/auth/forgot-password', { email: 'person@example.com' }));
  assert.equal(rejectedReset.status, 503);
  assert.equal((await rejectedReset.json()).error, 'Password reset email is not available yet');
  assert.equal((await load('app/api/auth/reset-password/route.ts').POST(request('/api/auth/reset-password', null))).status, 400);
  databaseError = true;
  assert.equal((await login(request('/api/auth/login', { email: 'person@example.com', password: 'password123' }))).status, 500);
  databaseError = false;
  cookie = auth.createSessionToken(rows[0].id);
  const send = await load('app/api/send/route.ts').POST(request('/api/send', { path: 'test.pdf', to: 'recipient@example.com', subject: 'Certificate' }));
  assert.equal(send.status, 401);
  assert.equal((await send.json()).code, 'RECONNECT_GMAIL');
  assert.equal(auth.verifySessionToken(auth.createResetToken(rows[0].id)), null);
  response = await load('app/api/auth/me/route.ts').GET();
  assert.equal((await response.json()).loggedIn, true); // Old schema lacks Gmail metadata.
  response = flow.startOAuth(request('/api/auth/google'), 'google');
  const url = new URL(response.headers.get('location'));
  assert.equal(url.searchParams.get('scope'), 'openid email profile');
  const stateCookie = response.cookies.get('google_oauth_state').value;
  process.env.GOOGLE_REDIRECT_URI = 'https://certify.test/api/auth/google/callback';
  response = await load('app/api/auth/google/callback/route.ts').GET(request(`/api/auth/google/callback?code=test-code&state=${url.searchParams.get('state')}`, undefined, `google_oauth_state=${stateCookie}`));
  assert.equal(exchangeRedirect, url.searchParams.get('redirect_uri'));
  assert(response.cookies.get('session'));
  assert.equal(updates.length, 0); // Google login never writes Gmail tokens.
  response = flow.startOAuth(request('/api/auth/gmail/connect'), 'gmail', rows[0].id);
  const gmailUrl = new URL(response.headers.get('location'));
  assert.equal(gmailUrl.searchParams.get('access_type'), 'offline');
  assert.equal(gmailUrl.searchParams.get('prompt'), 'consent');
  assert.equal(gmailUrl.searchParams.get('include_granted_scopes'), 'true');
  const gmailCookie = response.cookies.get('gmail_oauth_state').value;
  const callback = load('app/api/auth/gmail/callback/route.ts').GET;
  const callbackRequest = () => request(`/api/auth/gmail/callback?code=test-code&state=${gmailUrl.searchParams.get('state')}`, undefined, `gmail_oauth_state=${gmailCookie}`);
  response = await callback(callbackRequest());
  assert(response.headers.get('location').endsWith('/?gmail=denied'));
  assert.equal(rows[0].google_refresh_token, null);
  grantedScopes += ' https://www.googleapis.com/auth/gmail.send';
  response = await callback(callbackRequest());
  assert(response.headers.get('location').endsWith('/?connected=1'));
  assert.equal(updates.at(-1).id, rows[0].id);
  cookie = auth.createSessionToken(rows[1].id);
  assert((await callback(callbackRequest())).headers.get('location').endsWith('/?gmail=reconnect'));
  assert(!loggedErrors.join(' ').includes('test-signing-key-only'));
  assert(!loggedErrors.join(' ').includes('test-secret'));
  console.log('PASS: URL precedence, config failures before writes, email validation/hash/login, session flags, old schema session, Resend 403, send reconnect, scope separation, exact redirect reuse, per-user Gmail grants and state binding');
})().catch(() => { previousError('FAIL: auth regression check failed'); process.exitCode = 1; }).finally(() => {
  console.error = previousError;
  for (const name of Object.keys(process.env)) if (!(name in previousEnv)) delete process.env[name];
  Object.assign(process.env, previousEnv);
});
