import { randomUUID } from "crypto";
import { supabase } from "./db";
import { GMAIL_SEND_SCOPE, GOOGLE_OAUTH_CONFIG } from "./oauth";

export class GmailError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export interface GmailUser {
  user_id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_email: string | null;
  google_token_expiry: number | null;
  google_granted_scopes: string[] | null;
}
export async function getGmailConnection(userId: string): Promise<GmailUser | null> {
  const { data, error } = await supabase.from("gmail_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new GmailError("TOKEN_LOOKUP_FAILED", 500, "Could not load Gmail connection.");
  return data;
}
export function gmailConnected(user: GmailUser) {
  return Boolean(user.google_email && user.google_refresh_token && user.google_granted_scopes?.includes(GMAIL_SEND_SCOPE));
}
export async function accessToken(user: GmailUser, force = false): Promise<string> {
  if (!user.google_granted_scopes?.includes(GMAIL_SEND_SCOPE)) throw new GmailError("GMAIL_PERMISSION_MISSING", 403, "Log out, reconnect Gmail, and tick the Gmail permission box.");
  if (!user.google_email || !user.google_refresh_token) throw new GmailError("RECONNECT_GMAIL", 401, "Gmail not connected. Reconnect Gmail to send from your account.");
  if (!force && user.google_access_token && user.google_token_expiry && user.google_token_expiry > Date.now() + 60000) return user.google_access_token;
  if (!GOOGLE_OAUTH_CONFIG.clientId || !GOOGLE_OAUTH_CONFIG.clientSecret) throw new GmailError("SERVER_CONFIGURATION", 500, "Missing env: " + [!GOOGLE_OAUTH_CONFIG.clientId && "GOOGLE_CLIENT_ID", !GOOGLE_OAUTH_CONFIG.clientSecret && "GOOGLE_CLIENT_SECRET"].filter(Boolean).join(", "));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GOOGLE_OAUTH_CONFIG.clientId, client_secret: GOOGLE_OAUTH_CONFIG.clientSecret, refresh_token: user.google_refresh_token, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json().catch(() => { console.error("[GMAIL_REFRESH] Invalid token response."); return {}; });
  if (!res.ok) {
    if (res.status === 429) throw new GmailError("GMAIL_QUOTA", 429, "Google request quota reached. Try again later.");
    if (data.error === "invalid_grant") throw new GmailError("RECONNECT_GMAIL", 401, "Gmail access expired or was revoked. Reconnect Gmail.");
    throw new GmailError("GMAIL_REFRESH_FAILED", 500, "Could not refresh Gmail access. Try again later.");
  }
  if (!data.access_token || !data.expires_in) throw new GmailError("GMAIL_REFRESH_FAILED", 500, "Google returned an invalid token response.");
  const scopes = data.scope ? String(data.scope).split(/\s+/) : user.google_granted_scopes;
  const expiry = Date.now() + Number(data.expires_in) * 1000;
  const { error } = await supabase.from("gmail_tokens").update({ google_access_token: data.access_token, google_token_expiry: expiry, google_granted_scopes: scopes, ...(data.refresh_token ? { google_refresh_token: data.refresh_token } : {}) }).eq("user_id", user.user_id);
  if (error) throw new GmailError("TOKEN_SAVE_FAILED", 500, "Could not save refreshed Gmail connection.");
  if (!scopes?.includes(GMAIL_SEND_SCOPE)) throw new GmailError("GMAIL_PERMISSION_MISSING", 403, "Log out, reconnect Gmail, and tick the Gmail permission box.");
  return data.access_token;
}
const header = (value: string) => value.replace(/[\r\n]/g, " ");
const encodedHeader = (value: string) => `=?UTF-8?B?${Buffer.from(header(value)).toString("base64")}?=`;
const wrapBase64 = (value: string) => value.match(/.{1,76}/g)?.join("\r\n") || "";
export async function sendCertEmail(p: { user: GmailUser; to: string; subject: string; bodyHtml: string; fromName?: string; pdfBuffer: Buffer; attachmentName: string }) {
  let token = await accessToken(p.user);
  const boundary = `cert_${randomUUID()}`;
  const filename = header(p.attachmentName).replace(/["\\]/g, "_");
  const raw = [
    `From: ${p.fromName ? encodedHeader(p.fromName) + " " : ""}<${header(p.user.google_email!)}>`,
    `To: ${header(p.to)}`, `Subject: ${encodedHeader(p.subject)}`, "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`, "",
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", wrapBase64(Buffer.from(p.bodyHtml).toString("base64")),
    `--${boundary}`, `Content-Type: application/pdf; name="${filename}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${filename}"`, "", wrapBase64(p.pdfBuffer.toString("base64")), `--${boundary}--`, "",
  ].join("\r\n");
  const upload = (bearer: string) => fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media", {
    method: "POST", headers: { Authorization: `Bearer ${bearer}`, "Content-Type": "message/rfc822" }, body: raw, signal: AbortSignal.timeout(25000),
  });
  let res = await upload(token);
  // Retry only a definitive authentication rejection, never an ambiguous send timeout.
  if (res.status === 401) { token = await accessToken(p.user, true); res = await upload(token); }
  if (!res.ok) {
    const data = await res.json().catch(() => { console.error("[GMAIL_SEND] Non-JSON provider error."); return {}; });
    const reasons = (data.error?.errors || []).map((e: { reason?: string }) => e.reason);
    if (res.status === 429 || reasons.some((r: string) => ["rateLimitExceeded", "userRateLimitExceeded", "dailyLimitExceeded", "quotaExceeded"].includes(r))) throw new GmailError("GMAIL_QUOTA", 429, "Gmail sending quota reached. Try again later.");
    if (res.status === 401) throw new GmailError("RECONNECT_GMAIL", 401, "Gmail access expired. Reconnect Gmail.");
    if (res.status === 403) throw new GmailError("GMAIL_PERMISSION_MISSING", 403, "Log out, reconnect Gmail, and tick the Gmail permission box.");
    throw new GmailError("GMAIL_SEND_FAILED", 500, "Gmail could not send the certificate. Try again later.");
  }
  return { ok: true };
}
