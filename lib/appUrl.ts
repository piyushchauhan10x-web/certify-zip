import { headers } from "next/headers";
type UrlRequest = { headers: Headers };
export class AppConfigurationError extends Error {}
export function cleanEnvValue(value?: string): string {
  return (value || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}
function origin(value: string, source: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppConfigurationError('Invalid configuration: ' + source + ' must be an absolute URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new AppConfigurationError('Invalid configuration: ' + source + ' must be an HTTP(S) URL without credentials');
  if (process.env.NODE_ENV !== "development" && (url.protocol !== "https:" || /^(localhost|127\..*|\[::1\])$/i.test(url.hostname))) throw new AppConfigurationError('Invalid configuration: ' + source + ' must be a production HTTPS URL');
  return url.origin;
}
export function getAppUrl(req?: UrlRequest): string {
  const configured = cleanEnvValue(process.env.APP_URL).replace(/\/+$/, "");
  if (configured) return origin(configured, "APP_URL");
  let requestHeaders = req?.headers;
  if (!requestHeaders) {
    try { requestHeaders = headers(); } catch { requestHeaders = new Headers(); }
  }
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim();
  if (proto && host) {
    if (!/^[a-zA-Z0-9.\-\[\]:]+$/.test(host)) throw new AppConfigurationError("Invalid configuration: request host");
    return origin(proto + '://' + host, "request origin");
  }
  const productionHost = cleanEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (productionHost) return origin('https://' + productionHost.replace(/^https?:\/\//, ''), "VERCEL_PROJECT_PRODUCTION_URL");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  throw new AppConfigurationError("Missing env: APP_URL or VERCEL_PROJECT_PRODUCTION_URL (request host unavailable)");
}
export const GOOGLE_CALLBACK_PATH = "/api/auth/gmail/callback";
export function getGoogleRedirectUri(req?: UrlRequest) { return getAppUrl(req) + GOOGLE_CALLBACK_PATH; }
export function authCookieOptions(_req?: UrlRequest) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
}
export function requireGoogleCredentials() {
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(name => !cleanEnvValue(process.env[name]));
  if (missing.length) throw new AppConfigurationError('Missing env: ' + missing.join(', '));
}
export interface GoogleLoginConfig { clientId: string; clientSecret: string; baseUrl: string; redirectUri: string; }
export function getGoogleLoginConfig(req: UrlRequest): GoogleLoginConfig {
  requireGoogleCredentials();
  return { clientId: cleanEnvValue(process.env.GOOGLE_CLIENT_ID), clientSecret: cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET), baseUrl: getAppUrl(req), redirectUri: getGoogleRedirectUri(req) };
}
