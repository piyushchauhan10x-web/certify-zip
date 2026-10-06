import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { getGoogleLoginConfig, authCookieOptions } from "@/lib/appUrl";
import { authError } from "@/lib/authErrors";
import { readOAuthContext } from "@/lib/oauthFlow";
import { GMAIL_SEND_SCOPE } from "@/lib/oauth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try {
    const config = getGoogleLoginConfig(req);
    const redirect = (result: string) => {
      const response = NextResponse.redirect(new URL(result === "connected" ? "/?connected=1" : `/?gmail=${result}`, config.baseUrl));
      response.cookies.set("gmail_oauth_state", "", { ...authCookieOptions(), maxAge: 0 });
      return response;
    };
    const context = readOAuthContext(req, "gmail");
    const user = await getCurrentUser(true);
    if (!context || !user || context.userId !== user.id) return redirect("reconnect");
    if (req.nextUrl.searchParams.has("error")) return redirect("denied");
    const code = req.nextUrl.searchParams.get("code");
    if (!code) return redirect("reconnect");
    try {
      const client = new google.auth.OAuth2(config.clientId, config.clientSecret, context.redirectUri);
      client.transporter.defaults = { ...client.transporter.defaults, timeout: 10000 };
      const { tokens } = await client.getToken(code);
      const scopes = (tokens.scope || "").split(/\s+/).filter(Boolean);
      if (!scopes.includes(GMAIL_SEND_SCOPE)) {
        const { error } = await supabase.from("users").update({ google_granted_scopes: scopes, google_access_token: null, google_refresh_token: null, google_email: null, google_token_expiry: null }).eq("id", user.id);
        if (error) return redirect("reconnect");
        return redirect("denied");
      }
      client.setCredentials(tokens);
      const { data: profile } = await google.oauth2({ version: "v2", auth: client }).userinfo.get({}, { timeout: 10000 });
      if (!profile.email || !profile.verified_email) return redirect("reconnect");
      const refreshToken = tokens.refresh_token || (user.google_email === profile.email ? user.google_refresh_token : null);
      if (!refreshToken || !tokens.access_token) return redirect("reconnect");
      const { error } = await supabase.from("users").update({ google_access_token: tokens.access_token, google_refresh_token: refreshToken, google_email: profile.email, google_token_expiry: tokens.expiry_date, google_granted_scopes: scopes }).eq("id", user.id);
      if (error) return redirect("reconnect");
      return redirect("connected");
    } catch {
      console.error("[AUTH_ERROR] Gmail exchange or persistence failed.");
      return redirect("reconnect");
    }
  } catch (error) { return authError(error, "Gmail callback failed. Please try again."); }
}
