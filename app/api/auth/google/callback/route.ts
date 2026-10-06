import { emailLookupPattern } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { randomBytes } from "crypto";
import { supabase } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { getGoogleLoginConfig, authCookieOptions } from "@/lib/appUrl";
import { authError, requireEnv } from "@/lib/authErrors";
import { readOAuthContext } from "@/lib/oauthFlow";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try {
    requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "JWT_SECRET");
    const config = getGoogleLoginConfig(req);
    const redirect = (error?: string) => {
      const response = NextResponse.redirect(new URL(error ? `/login?error=${error}` : "/", config.baseUrl));
      response.cookies.set("google_oauth_state", "", { ...authCookieOptions(), maxAge: 0 });
      return response;
    };
    const context = readOAuthContext(req, "google");
    if (!context) return redirect("oauth_state");
    if (req.nextUrl.searchParams.has("error")) return redirect("oauth_denied");
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return redirect("oauth_failed");
    try {
      const client = new google.auth.OAuth2(config.clientId, config.clientSecret, context.redirectUri);
      client.transporter.defaults = { ...client.transporter.defaults, timeout: 10000 };
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);
      const { data: profile } = await google.oauth2({ version: "v2", auth: client }).userinfo.get({}, { timeout: 10000 });
      if (!profile.email || !profile.verified_email) return redirect("oauth_identity");
      const email = profile.email.trim().toLowerCase();
      const { data: existing, error } = await supabase.from("users").select("id").ilike("email", emailLookupPattern(email)).maybeSingle();
      if (error) return redirect("oauth_database");
      let userId = existing?.id;
      if (!userId) {
        const result = await supabase.from("users").insert({ email, password_hash: await hashPassword(randomBytes(32).toString("hex")) }).select("id").single();
        if (result.error?.code === "23505") {
          const retry = await supabase.from("users").select("id").ilike("email", emailLookupPattern(email)).single();
          userId = retry.data?.id;
        } else userId = result.data?.id;
        if (!userId) return redirect("oauth_database");
      }
      const response = redirect();
      response.cookies.set("session", createSessionToken(userId), { ...authCookieOptions(), maxAge: 60 * 60 * 24 * 30 });
      return response;
    } catch (error) {
      const providerCode = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (providerCode === "invalid_client") {
        console.error("[AUTH_ERROR] Invalid GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.");
        return redirect("oauth_client");
      }
      if (providerCode === "redirect_uri_mismatch") {
        console.error("[AUTH_ERROR] GOOGLE_REDIRECT_URI does not match Google Cloud configuration.");
        return redirect("oauth_redirect");
      }
      console.error("[AUTH_ERROR] Google identity exchange failed.");
      return redirect("oauth_failed");
    }
  } catch (error) { return authError(error, "Google callback failed. Please try again."); }
}
