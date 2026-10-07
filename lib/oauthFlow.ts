import { randomBytes, timingSafeEqual, createHmac } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, getGoogleLoginConfig, GoogleLoginConfig } from "./appUrl";
import { requireEnv } from "./authErrors";
import { GMAIL_SEND_SCOPE } from "./oauth";
type Context = { state: string; redirectUri: string; userId: string; expires: number };
function signature(value: string) {
  requireEnv("SUPABASE_SERVICE_KEY");
  return createHmac("sha256", process.env.SUPABASE_SERVICE_KEY!.trim()).update(`gmail-oauth:${value}`).digest("hex");
}
export function startOAuth(req: NextRequest, userId: string, config: GoogleLoginConfig = getGoogleLoginConfig(req)) {
  const state = randomBytes(32).toString("hex");
  const context: Context = { state, redirectUri: config.redirectUri, userId, expires: Date.now() + 600000 };
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: context.redirectUri, response_type: "code", state,
    scope: `openid email profile ${GMAIL_SEND_SCOPE} https://www.googleapis.com/auth/spreadsheets.readonly`,
    access_type: "offline", prompt: "consent", include_granted_scopes: "true",
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  const response = req.nextUrl.searchParams.get("format") === "json" ? NextResponse.json({ url }) : NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  const encoded = Buffer.from(JSON.stringify(context)).toString("base64url");
  response.cookies.set("gmail_oauth_state", `${encoded}.${signature(encoded)}`, { ...authCookieOptions(), maxAge: 600 });
  return response;
}
export function readOAuthContext(req: NextRequest): Context | null {
  try {
    const [encoded, mac] = (req.cookies.get("gmail_oauth_state")?.value || "").split(".");
    if (!encoded || !mac) return null;
    const expected = Buffer.from(signature(encoded));
    const actual = Buffer.from(mac);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const context: Context = JSON.parse(Buffer.from(encoded, "base64url").toString());
    const state = Buffer.from(req.nextUrl.searchParams.get("state") || "");
    const saved = Buffer.from(context.state);
    if (context.expires < Date.now() || !state.length || state.length !== saved.length || !timingSafeEqual(state, saved)) return null;
    return context;
  } catch { console.error("[GMAIL_STATE] Invalid or expired OAuth state."); return null; }
}
