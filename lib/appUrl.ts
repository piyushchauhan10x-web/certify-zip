import { headers } from "next/headers";

type UrlRequest = { headers: Headers };
export class AppConfigurationError extends Error {}

export function cleanEnvValue(value?: string): string {
  return (value || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

function origin(value: string, source: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppConfigurationError(`Invalid configuration: ${source} must be an absolute URL`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new AppConfigurationError(`Invalid configuration: ${source} must be an HTTP(S) URL without credentials`);
  }
  if (process.env.NODE_ENV !== "development" && (url.protocol !== "https:" || /^(localhost|127\..*|\[::1\])$/i.test(url.hostname))) {
    throw new AppConfigurationError(`Invalid configuration: ${source} must be a production HTTPS URL`);
  }
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
  const host = (requestHeaders.get("x-forwarded-host") || requestHeaders.get("host"))?.split(",")[0].trim();
  if (host) {
    // These headers are supplied by the deployment's reverse proxy.
    if (!/^[a-zA-Z0-9.\-\[\]:]+$/.test(host)) throw new AppConfigurationError("Invalid configuration: request host");
    return origin(`${proto || (process.env.NODE_ENV === "development" ? "http" : "https")}://${host}`, "request origin");
  }

  const productionHost = cleanEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (productionHost) return origin(`https://${productionHost.replace(/^https?:\/\//, "")}`, "VERCEL_PROJECT_PRODUCTION_URL");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  throw new AppConfigurationError("Missing env: APP_URL or VERCEL_PROJECT_PRODUCTION_URL (request host unavailable)");
}

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export function getGoogleRedirectUri(req?: UrlRequest): string {
  const configured = cleanEnvValue(process.env.GOOGLE_REDIRECT_URI);
  if (!configured) return `${getAppUrl(req)}${GOOGLE_CALLBACK_PATH}`;
  const base = origin(configured, "GOOGLE_REDIRECT_URI");
  const url = new URL(configured);
  if (url.pathname !== GOOGLE_CALLBACK_PATH || url.search || url.hash) {
    throw new AppConfigurationError(`Invalid configuration: GOOGLE_REDIRECT_URI must use ${GOOGLE_CALLBACK_PATH}`);
  }
  return `${base}${GOOGLE_CALLBACK_PATH}`;
}

export function authCookieOptions(req?: UrlRequest) {
  const url = new URL(getAppUrl(req));
  const domain = cleanEnvValue(process.env.COOKIE_DOMAIN).replace(/^\./, "");
  if (domain && domain !== url.hostname) throw new AppConfigurationError("Invalid configuration: COOKIE_DOMAIN must match the app hostname");
  return { httpOnly: true, secure: url.protocol === "https:", sameSite: "lax" as const, path: "/", ...(domain ? { domain } : {}) };
}

export function requireGoogleCredentials() {
  const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(key => !cleanEnvValue(process.env[key]));
  if (missing.length) throw new AppConfigurationError(`Missing env: ${missing.join(", ")}`);
}
