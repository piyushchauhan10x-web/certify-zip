const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

// No external services or real credentials: exercise the production sender.
const scope = 'https://www.googleapis.com/auth/gmail.send';
const updates = [];
const source = ts.transpileModule(fs.readFileSync('lib/gmail.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = new Module('gmail-check');
mod.require = (name) => {
  if (name === './oauth') return { GMAIL_SEND_SCOPE: scope, GOOGLE_OAUTH_CONFIG: { clientId: 'test-client', clientSecret: 'test-secret' } };
  if (name === './db') return { supabase: { from: () => ({ update: (value) => ({ eq: async (key, id) => { updates.push({ key, id, value }); return { error: null }; } }) }) } };
  return require(name);
};
mod._compile(source, 'gmail-check.cjs');
const { sendCertEmail } = mod.exports;
const user = { id: 'user-two', google_email: 'user-two@example.com', google_access_token: 'user-two-token', google_refresh_token: 'user-two-refresh', google_token_expiry: Date.now() + 3600000, google_granted_scopes: [scope] };
const pdf = Buffer.alloc(8 * 1024 * 1024, 123);
const params = { user, to: 'recipient@example.com', subject: 'Certificate', bodyHtml: '<p>Attached</p>', pdfBuffer: pdf, attachmentName: 'certificate.pdf' };
const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const rejectCode = (code, status) => (error) => error.code === code && error.status === status;

(async () => {
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    assert.equal(url, 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media');
    assert.equal(options.headers.Authorization, 'Bearer user-two-token');
    assert.equal(options.headers['Content-Type'], 'message/rfc822');
    assert.match(options.body, /From: <user-two@example.com>/);
    const encoded = options.body.split('Content-Disposition: attachment; filename="certificate.pdf"\r\n\r\n')[1].split('\r\n--')[0];
    assert.deepEqual(Buffer.from(encoded, 'base64'), pdf);
    return reply(200, { id: 'message-id' });
  };
  await sendCertEmail(params);
  assert.equal(calls, 1);
  await assert.rejects(sendCertEmail({ ...params, user: { ...user, google_granted_scopes: [] } }), rejectCode('RECONNECT_GMAIL', 401));
  assert.equal(calls, 1);
  global.fetch = async () => reply(400, { error: 'invalid_grant' });
  await assert.rejects(sendCertEmail({ ...params, user: { ...user, google_token_expiry: 1 } }), rejectCode('RECONNECT_GMAIL', 401));
  global.fetch = async () => reply(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } });
  await assert.rejects(sendCertEmail(params), rejectCode('GMAIL_QUOTA', 429));
  global.fetch = async (url, options) => {
    if (url.includes('oauth2.googleapis.com')) {
      assert.equal(options.body.get('refresh_token'), 'user-two-refresh');
      return reply(200, { access_token: 'refreshed-user-two', expires_in: 3600, scope });
    }
    assert.equal(options.headers.Authorization, 'Bearer refreshed-user-two');
    return reply(200, { id: 'refreshed-message' });
  };
  await sendCertEmail({ ...params, user: { ...user, google_token_expiry: 1 } });
  assert.equal(updates[0].key, 'id');
  assert.equal(updates[0].id, 'user-two');
  console.log('PASS: intact 8 MB attachment, current-user sender, scope rejection, invalid_grant, quota mapping, per-user refresh persistence');
})().catch((error) => { console.error(error); process.exitCode = 1; });
