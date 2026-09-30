import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildAuthUrl, GOOGLE_OAUTH_CONFIG } from "@/lib/oauth";

export async function GET() {
  if (!GOOGLE_OAUTH_CONFIG.clientId) {
    console.error("[OAUTH_CRITICAL_ERROR] GOOGLE_CLIENT_ID environment variable is missing on server!");
    return NextResponse.json(
      {
        error: "Google Client ID is missing. Please set GOOGLE_CLIENT_ID or NEXT_PUBLIC_GOOGLE_CLIENT_ID in Vercel Environment Variables.",
      },
      { status: 500 }
    );
  }
  const user = await getCurrentUser();
  const state = user ? user.id : "signin";
  return NextResponse.redirect(buildAuthUrl(state));
}
