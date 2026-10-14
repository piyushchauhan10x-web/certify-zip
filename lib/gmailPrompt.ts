// A tab-local, short-lived intent marker, never an authorization credential.
const key = "certify_google_login_intent";
export function markGoogleLogin(storage: Storage, now = Date.now()) {
  storage.setItem(key, String(now));
}
export function clearGoogleLogin(storage: Storage) { storage.removeItem(key); }
export function consumeGoogleLogin(storage: Storage, completed: boolean, now = Date.now()) {
  const value = storage.getItem(key);
  storage.removeItem(key);
  const started = Number(value);
  return completed && value !== null && Number.isFinite(started) && now >= started && now - started < 10 * 60 * 1000;
}
