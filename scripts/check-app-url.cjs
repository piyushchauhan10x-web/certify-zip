const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const app = new Module('app-url-check');
app.require = (name) => name === 'next/headers' ? { headers: () => new Headers() } : require(name);
app._compile(ts.transpileModule(fs.readFileSync('lib/appUrl.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'app-url-check.cjs');
const { getAppUrl, getGoogleRedirectUri, authCookieOptions, requireGoogleCredentials, getGoogleLoginConfig } = app.exports;
const original = { ...process.env };
const request = { headers: new Headers({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'certify-zip.vercel.app', host: 'internal-host' }) };
try {
  process.env.NODE_ENV = 'production';
  for (const key of ['APP_URL', 'GOOGLE_REDIRECT_URI', 'VERCEL_PROJECT_PRODUCTION_URL', 'COOKIE_DOMAIN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']) delete process.env[key];
  assert.equal(getAppUrl(request), 'https://certify-zip.vercel.app');
  assert.equal(getGoogleRedirectUri(request), 'https://certify-zip.vercel.app/api/auth/gmail/callback');
  assert.deepEqual(authCookieOptions(request), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  process.env.APP_URL = ' "https://canonical.example///" ';
  assert.equal(getAppUrl(request), 'https://canonical.example');
  process.env.GOOGLE_REDIRECT_URI = ' https://certify-zip.vercel.app/api/auth/gmail/callback ';
  assert.equal(getGoogleRedirectUri(request), 'https://certify-zip.vercel.app/api/auth/gmail/callback');
  delete process.env.APP_URL;
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'certify-zip.vercel.app';
  assert.equal(getAppUrl(), 'https://certify-zip.vercel.app');
  assert.equal(getAppUrl({ headers: new Headers({ host: 'other.example' }) }), 'https://other.example');
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  assert.throws(() => getAppUrl(), /Missing env: APP_URL or VERCEL_PROJECT_PRODUCTION_URL/);
  assert.throws(() => getAppUrl({ headers: new Headers({ 'x-forwarded-host': 'localhost:3000', 'x-forwarded-proto': 'http' }) }), /production HTTPS URL/);
  process.env.NODE_ENV = 'development';
  assert.equal(getAppUrl(), 'http://localhost:3000');
  assert.throws(requireGoogleCredentials, /Missing env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET/);
  process.env.GOOGLE_CLIENT_ID = 'test-id';
  assert.throws(requireGoogleCredentials, /Missing env: GOOGLE_CLIENT_SECRET$/);
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
  requireGoogleCredentials();
  process.env.NODE_ENV = 'production';
  delete process.env.GOOGLE_REDIRECT_URI;
  process.env.GOOGLE_CLIENT_ID = ' "test-id" ';
  process.env.GOOGLE_CLIENT_SECRET = " 'test-secret' ";
  const config = getGoogleLoginConfig(request);
  assert.equal(config.clientId, 'test-id');
  assert.equal(config.clientSecret, 'test-secret');
  assert.equal(config.baseUrl, 'https://certify-zip.vercel.app');
  assert.equal(config.redirectUri, 'https://certify-zip.vercel.app/api/auth/gmail/callback');
  process.env.GOOGLE_REDIRECT_URI = ' "https://certify-zip.vercel.app/api/auth/gmail/callback" ';
  assert.equal(getGoogleLoginConfig(request).redirectUri, config.redirectUri);
  // Reads reflect changes after the module was loaded, rather than a cached snapshot.
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.throws(() => getGoogleLoginConfig(request), /^Error: Missing env: GOOGLE_CLIENT_SECRET$/);
  assert.throws(() => getGoogleLoginConfig({ headers: new Headers() }), /^Error: Missing env: GOOGLE_CLIENT_SECRET, APP_URL$/);
  delete process.env.GOOGLE_CLIENT_ID;
  assert.throws(() => getGoogleLoginConfig(request), /^Error: Missing env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET$/);
  process.env.GOOGLE_REDIRECT_URI = 'https://certify-zip.vercel.app/wrong';
  assert.throws(() => getGoogleLoginConfig(request), /Missing env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; Invalid configuration: GOOGLE_REDIRECT_URI/);
  console.log('PASS: missing APP_URL production request, env normalization, URL fallback order, callback URI, secure cookies, missing credential names, development-only localhost');
} finally {
  for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
  Object.assign(process.env, original);
}
