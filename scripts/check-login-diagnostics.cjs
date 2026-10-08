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
  const auth = load('lib/authUi.ts');
  assert.equal(auth.authMessage({ message: 'Unsupported provider: provider is not enabled' }), 'Supabase Google provider is not enabled');
  assert.equal(auth.authMessage({ message: 'Supabase explanation', code: 'other' }), 'Supabase explanation');
  assert.equal(auth.authException(new Error('Missing config: NEXT_PUBLIC_SUPABASE_URL')), 'Missing config: NEXT_PUBLIC_SUPABASE_URL');
  assert.ok(!auth.safeAuthMessage('https://private.example?access_token=value').includes('private.example'));
  const navigations = [];
  await auth.redirectToGoogle({ auth: { signInWithOAuth: async options => {
    assert.equal(options.provider, 'google'); assert.equal(options.options.skipBrowserRedirect, true);
    assert.equal(options.options.scopes, undefined); assert.equal(options.options.redirectTo, 'https://certify.example/auth/callback');
    return { data: { url: 'https://provider.example/authorize' }, error: null };
  } } }, 'https://certify.example/auth/callback', url => navigations.push(url));
  assert.deepEqual(navigations, ['https://provider.example/authorize']);
  await assert.rejects(auth.redirectToGoogle({ auth: { signInWithOAuth: async () => ({ data: {}, error: new Error('Provider rejected login') }) } }, 'https://certify.example/auth/callback', () => assert.fail('must not navigate')), /Provider rejected login/);
  await assert.rejects(auth.redirectToGoogle({ auth: { signInWithOAuth: async () => ({ data: {}, error: null }) } }, 'https://certify.example/auth/callback', () => assert.fail('must not navigate')), /did not return/);
  const { probeSupabaseAuth } = load('lib/supabase/diagnostics.ts', { './config': {} });
  const config = { url: 'https://public.example', key: 'sb_publishable_test' };
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://public.example/auth/v1/settings'); assert.equal(options.headers.apikey, config.key); assert.equal(options.cache, 'no-store');
    return new Response(JSON.stringify({ external: { google: true }, ignored: 'not returned' }));
  };
  assert.deepEqual(await probeSupabaseAuth(config), { ok: true, supabaseReachable: true, googleProviderEnabled: true });
  global.fetch = async () => new Response(JSON.stringify({ external: { google: false } }));
  assert.equal((await probeSupabaseAuth(config)).googleProviderEnabled, false);
  global.fetch = async () => new Response('', { status: 401 });
  const rejected = await probeSupabaseAuth(config);
  assert.equal(rejected.supabaseReachable, true); assert.equal(rejected.ok, false); assert.match(rejected.error, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  global.fetch = async () => { throw new TypeError('transport failure with private details'); };
  const network = await probeSupabaseAuth(config);
  assert.equal(network.supabaseReachable, false); assert.equal(network.error, 'Network error reaching Supabase');
  const originalTimeout = AbortSignal.timeout;
  try {
    AbortSignal.timeout = ms => { assert.equal(ms, 5000); return AbortSignal.abort(new DOMException('Timeout', 'TimeoutError')); };
    const timeout = await probeSupabaseAuth(config); assert.match(timeout.error, /5 seconds/);
  } finally { AbortSignal.timeout = originalTimeout; }
  const { authFetch } = load('lib/http.ts');
  await assert.rejects(authFetch('https://public.example'), /Network error reaching Supabase/);
  const healthNames = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_KEY','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET'];
  healthNames.forEach(name => process.env[name] = 'test-placeholder');
  let probe = { ok: true, supabaseReachable: true, googleProviderEnabled: true };
  let missing = false;
  const publicAuthConfig = () => { if (missing) throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'); return config; };
  const mocks = { '@/lib/supabase/config': { publicAuthConfig }, '@/lib/supabase/diagnostics': { probeSupabaseAuth: async () => probe }, '@/lib/appUrl': { getAppUrl: () => 'https://certify.example' } };
  const health = load('app/api/health/route.ts', mocks);
  assert.deepEqual(await (await health.GET()).json(), { ok: true, missingEnv: [], supabaseReachable: true, googleProviderEnabled: true });
  probe = { ok: true, supabaseReachable: true, googleProviderEnabled: false };
  assert.equal((await health.GET()).status, 503);
  const conf = load('app/api/auth/config/route.ts', mocks);
  assert.equal((await conf.GET(new NextRequest('https://certify.example/api/auth/config'))).status, 200); // Email remains usable.
  missing = true; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missingHealth = await (await health.GET()).json();
  assert.deepEqual(missingHealth.missingEnv, healthNames.slice(0,2)); assert.equal(missingHealth.supabaseReachable, false); assert.ok(!('googleProviderEnabled' in missingHealth));
  const missingConfig = await conf.GET(new NextRequest('https://certify.example/api/auth/config'));
  assert.equal(missingConfig.status, 503); assert.equal((await missingConfig.json()).error, 'Missing config: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY');
  let sessionError = { message: 'Provider exchange rejected', code: 'provider_error' };
  const callback = load('app/auth/callback/route.ts', {
    '@/lib/supabase/server': { createClient: () => ({ auth: { exchangeCodeForSession: async () => ({ error: sessionError }) } }) },
    '@/lib/appUrl': { getAppUrl: () => 'https://certify.example' },
    '@/lib/authErrors': { authError: () => { throw Error('unexpected callback exception'); } }, '@/lib/authUi': auth,
  });
  const rejectedCallback = await callback.GET(new NextRequest('https://certify.example/auth/callback?code=test-code'));
  assert.equal(new URL(rejectedCallback.headers.get('location')).searchParams.get('message'), 'Provider exchange rejected');
  sessionError = null;
  const recovery = await callback.GET(new NextRequest('https://certify.example/auth/callback?code=test-code&next=/reset-password'));
  assert.equal(new URL(recovery.headers.get('location')).pathname, '/reset-password');
  const hostileNext = await callback.GET(new NextRequest('https://certify.example/auth/callback?code=test-code&next=https://evil.example'));
  assert.equal(hostileNext.headers.get('location'), 'https://certify.example/');
  console.log('PASS: explicit OAuth navigation, no Gmail scopes, provider/missing-URL rejection, real errors, redaction, settings health/provider flags, rejected key, network failure, 5s deadline, missing runtime config, disabled Google preserves email config');
})().catch(error => { console.error(error); process.exitCode = 1; });
