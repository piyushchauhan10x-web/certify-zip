import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { GOOGLE_OAUTH_CONFIG } from "@/lib/oauth";
import { supabase } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", req.url));
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: profile } = await oauth2.userinfo.get();

  if (state === "signin") {
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", profile.email)
      .single();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await supabase
        .from("users")
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_email: profile.email,
        })
        .eq("id", userId);
    } else {
      const randomPassword = await hashPassword(nanoid(32));
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({
          email: profile.email,
          password_hash: randomPassword,
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token,
          google_email: profile.email,
        })
        .select("id")
        .single();

      if (error || !newUser) {
        return NextResponse.redirect(new URL("/login?error=account_creation_failed", req.url));
      }
      userId = newUser.id;
    }

    const sessionToken = createSessionToken(userId);
    const res = NextResponse.redirect(new URL("/?connected=1", req.url));
    res.cookies.set("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  await supabase
    .from("users")
    .update({
      google_access_token: tokens.access_token,
      google_refresh_token: tokens.refresh_token,
      google_email: profile.email,
    })
    .eq("id", state);

  return NextResponse.redirect(new URL("/?connected=1", req.url));
}
