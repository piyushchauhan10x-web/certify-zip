import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { timingSafeEqual } from "crypto";
import { getBaseUrl, getRedirectUri, GOOGLE_OAUTH_CONFIG, GMAIL_SEND_SCOPE, authCookieOptions } from "@/lib/oauth";
import { supabase } from "@/lib/db";
import { createSessionToken, hashPassword, getCurrentUser } from "@/lib/auth";
import { nanoid } from "nanoid";
import { AppConfigurationError, requireGoogleCredentials } from "@/lib/appUrl";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let baseUrl: string;
  let redirectUri: string;
  let cookieOptions: ReturnType<typeof authCookieOptions>;
  try {
    requireGoogleCredentials();
    baseUrl = getBaseUrl(req);
    redirectUri = getRedirectUri(req);
    cookieOptions = authCookieOptions(req);
  } catch (err) {
    const error = err instanceof AppConfigurationError ? err.message : "Google callback is not configured.";
    console.error("[OAUTH_ERROR]", { step: "callback_configuration", error });
    return NextResponse.json({ error }, { status: 500 });
  }
  const redirect = (path: string) => {
    const res = NextResponse.redirect(new URL(path, baseUrl));
    res.cookies.set("google_oauth_state", "", { ...cookieOptions, maxAge: 0 });
    return res;
  };
  const state = req.nextUrl.searchParams.get("state") || "";
  const expected = req.cookies.get("google_oauth_state")?.value || "";
  if (!state || !expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) return redirect("/login?error=oauth_failed");
  if (req.nextUrl.searchParams.get("error") === "access_denied") return redirect("/?gmail=denied");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return redirect("/login?error=oauth_failed");
  try {
    const client = new google.auth.OAuth2(GOOGLE_OAUTH_CONFIG.clientId, GOOGLE_OAUTH_CONFIG.clientSecret, redirectUri);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const { data: profile } = await google.oauth2({ version: "v2", auth: client }).userinfo.get();
    if (!profile.email || !profile.verified_email) throw new Error("Unverified Google identity");
    const scopes = (tokens.scope || "").split(/\s+/).filter(Boolean);
    const hasGmail = scopes.includes(GMAIL_SEND_SCOPE);
    const currentUser = await getCurrentUser();
    const { data: existing, error: lookupError } = await supabase.from("users").select("id, google_email, google_refresh_token").eq(currentUser ? "id" : "email", currentUser ? currentUser.id : profile.email).maybeSingle();
    if (lookupError) throw new Error("User lookup failed");
    const refreshToken = hasGmail ? (tokens.refresh_token || (existing?.google_email === profile.email ? existing.google_refresh_token : null)) : null;
    const connection = {
      google_access_token: hasGmail ? tokens.access_token : null,
      google_refresh_token: refreshToken,
      google_email: hasGmail ? profile.email : null,
      google_token_expiry: hasGmail ? tokens.expiry_date : null,
      google_granted_scopes: scopes,
    };
    let userId = existing?.id;
    if (userId) {
      const { error } = await supabase.from("users").update(connection).eq("id", userId);
      if (error) throw new Error("Google connection persistence failed");
    } else {
      const { data, error } = await supabase.from("users").insert({ email: profile.email, password_hash: await hashPassword(nanoid(32)), ...connection }).select("id").single();
      if (error || !data) throw new Error("Account creation failed");
      userId = data.id;
    }
    const res = redirect(!hasGmail ? "/?gmail=denied" : !refreshToken ? "/?gmail=reconnect" : "/?connected=1");
    res.cookies.set("session", createSessionToken(userId), { ...cookieOptions, maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch {
    // OAuth library errors may contain token request bodies; never log them.
    console.error("[OAUTH_ERROR]", { step: "callback_exchange_or_save", recipient: "unknown" });
    return redirect("/login?error=oauth_failed");
  }
}
