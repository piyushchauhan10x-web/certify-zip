import { NextRequest } from "next/server";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export function getBaseUrl(_req?: NextRequest): string {
  const value = process.env.APP_URL?.trim() || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!value) throw new Error("APP_URL must be configured in production.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("APP_URL must be a production HTTPS URL.");
  return url.origin;
}
export function getRedirectUri(_req?: NextRequest): string {
  const value = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!value && process.env.NODE_ENV === "production") throw new Error("GOOGLE_REDIRECT_URI must be configured in production.");
  const url = new URL(value || `${getBaseUrl()}/api/auth/google/callback`);
  if (url.origin !== getBaseUrl() || url.pathname !== "/api/auth/google/callback") throw new Error("GOOGLE_REDIRECT_URI must match APP_URL/api/auth/google/callback.");
  return url.toString();
}
export function authCookieOptions() {
  const hostname = new URL(getBaseUrl()).hostname;
  const domain = process.env.COOKIE_DOMAIN?.trim().replace(/^\./, "");
  if (domain && domain !== hostname) throw new Error("COOKIE_DOMAIN must match the APP_URL hostname; do not use .vercel.app.");
  return { httpOnly: true, secure: new URL(getBaseUrl()).protocol === "https:", sameSite: "lax" as const, path: "/", ...(domain ? { domain } : {}) };
}
export const GOOGLE_OAUTH_CONFIG = {
  get clientId() { return (process.env.GOOGLE_CLIENT_ID || "").trim(); },
  get clientSecret() { return (process.env.GOOGLE_CLIENT_SECRET || "").trim(); },
  get redirectUri() { return getRedirectUri(); },
  // Keep Sheets access for the existing recipient import feature.
  scopes: ["openid", "email", "profile", GMAIL_SEND_SCOPE, "https://www.googleapis.com/auth/spreadsheets.readonly"],
};
export function buildAuthUrl(state: string, _req?: NextRequest): string {
  if (!GOOGLE_OAUTH_CONFIG.clientId) throw new Error("GOOGLE_CLIENT_ID is missing.");
  const params = new URLSearchParams({ client_id: GOOGLE_OAUTH_CONFIG.clientId, redirect_uri: getRedirectUri(), response_type: "code", scope: GOOGLE_OAUTH_CONFIG.scopes.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
