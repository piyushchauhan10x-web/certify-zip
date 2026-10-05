import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, getBaseUrl, authCookieOptions } from "@/lib/oauth";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const baseUrl = getBaseUrl();
    // Start on the canonical domain so the state and session cookies reach the callback.
    if (req.nextUrl.origin !== baseUrl) return NextResponse.redirect(new URL("/api/auth/google", baseUrl));
    const state = randomBytes(32).toString("hex");
    const res = NextResponse.redirect(buildAuthUrl(state));
    res.cookies.set("google_oauth_state", state, { ...authCookieOptions(), maxAge: 600 });
    return res;
  } catch {
    console.error("[OAUTH_ERROR]", { step: "login_configuration", recipient: "unknown" });
    return NextResponse.json({ error: "Google login is not configured. Check APP_URL and Google OAuth settings." }, { status: 500 });
  }
}
