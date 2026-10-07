const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { NextRequest } = require('next/server');
function load(path, mocks = {}) {
  const m = new Module(path);
  m.require = name => name in mocks ? mocks[name] : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, path);
  return m.exports;
}
(async () => {
  const { sessionCookieOptions } = load('lib/sessionCookies.ts');
  assert.equal(sessionCookieOptions({ maxAge: 86400 }, '0').maxAge, undefined);
  assert.equal(sessionCookieOptions({ maxAge: 0 }, '0').maxAge, 0);
  assert.equal(sessionCookieOptions({ maxAge: 86400 }, '1').maxAge, 86400);
  const { request } = load('lib/http.ts');
  global.fetch = async () => new Response(JSON.stringify({ error: 'Tick the Gmail permission box', code: 'GMAIL_PERMISSION_MISSING' }), { status: 403 });
  await assert.rejects(request('/test'), e => e.status === 403 && e.message === 'Tick the Gmail permission box');
  global.fetch = async () => new Response('Upstream unavailable', { status: 502 });
  await assert.rejects(request('/test'), /Upstream unavailable/);
  global.fetch = async (_, { signal }) => new Response(new ReadableStream({ start(c) { signal.addEventListener('abort', () => c.error(new Error('aborted'))); } }));
  await assert.rejects(request('/test', {}, 10), e => e.status === 408);
  const config = load('lib/supabase/config.ts');
  delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.throws(config.publicAuthConfig, /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_test';
  assert.throws(config.publicAuthConfig, /never a service key/);
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_test';
  assert.equal(config.publicAuthConfig().key, 'sb_publishable_test');
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  let user = { id }, connection = { user_id: id }, sent = 0, deleted = [], downloaded = [], failure = null;
  class GmailError extends Error { constructor(code, status, message) { super(message); this.code = code; this.status = status; } }
  class AppConfigurationError extends Error {}
  const route = load('app/api/send/route.ts', {
    '@/lib/auth': { getCurrentUser: async () => user },
    '@/lib/db': { supabase: { storage: { from: () => ({ download: async path => { downloaded.push(path); return { data: new Blob(['%PDF-test']), error: null }; }, remove: async paths => { deleted.push(...paths); return { error: null }; } }) } } },
    '@/lib/gmail': { GmailError, getGmailConnection: async target => { assert.equal(target, id); return connection; }, sendCertEmail: async p => { assert.equal(p.user.user_id, id); if (failure) throw failure; sent++; } },
    '@/lib/email': { hasVerifiedResendSender: async () => false, sendCertEmailViaResend: async () => { throw Error('unexpected fallback'); } },
    '@/lib/appUrl': { AppConfigurationError }, '@/lib/rateLimit': { checkRateLimit: () => true },
  });
  const payload = { path: id + '/' + other + '.pdf', to: 'recipient@example.com', subject: 'Certificate', message: '<script>text</script>' };
  const post = body => route.POST(new NextRequest('https://certify.test/api/send', { method: 'POST', body: JSON.stringify(body) }));
  user = null; assert.equal((await post(payload)).status, 401); assert.equal(deleted.length, 0);
  user = { id }; assert.equal((await post({ ...payload, path: other + '/' + id + '.pdf' })).status, 400); assert.equal(deleted.length, 0); assert.equal(downloaded.length, 0);
  assert.equal((await post({ ...payload, to: 'bad-email' })).status, 400);
  assert.equal((await post(payload)).status, 200); assert.equal(sent, 1); assert.deepEqual(deleted, [payload.path]);
  failure = new GmailError('GMAIL_PERMISSION_MISSING', 403, 'Tick Gmail permission');
  assert.equal((await post(payload)).status, 403); assert.equal(deleted.length, 2);
  connection = null;
  assert.equal((await post(payload)).status, 401); assert.equal(deleted.length, 3);
  console.log('PASS: real server messages, non-JSON errors, body timeout, missing env names, privileged key rejection, unauthenticated/foreign path rejection, recipient validation, successful send, cleanup after success/failure, no unverified fallback');
})().catch(error => { console.error(error); process.exitCode = 1; });
