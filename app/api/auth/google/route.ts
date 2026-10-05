import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, getRedirectUri, authCookieOptions } from "@/lib/oauth";
import { AppConfigurationError, requireGoogleCredentials } from "@/lib/appUrl";
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    requireGoogleCredentials();
    const baseUrl = new URL(getRedirectUri(req)).origin;
    // Start on the canonical domain so the state and session cookies reach the callback.
    if (req.nextUrl.origin !== baseUrl) return NextResponse.redirect(new URL("/api/auth/google", baseUrl));
    const state = randomBytes(32).toString("hex");
    const res = NextResponse.redirect(buildAuthUrl(state, req));
    res.cookies.set("google_oauth_state", state, { ...authCookieOptions(req), maxAge: 600 });
    return res;
  } catch (err) {
    const error = err instanceof AppConfigurationError ? err.message : "Google login could not be started.";
    console.error("[OAUTH_ERROR]", { step: "login_configuration", error });
    return NextResponse.json({ error }, { status: 500 });
  }
}
