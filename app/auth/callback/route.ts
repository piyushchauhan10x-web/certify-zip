import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { authError } from "@/lib/authErrors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try {
    const base = getAppUrl(req);
    const code = req.nextUrl.searchParams.get("code");
    if (code) {
      const { error } = await createClient().auth.exchangeCodeForSession(code);
      if (!error) {
        const next = req.nextUrl.searchParams.get("next");
        const target = next === "/reset-password" || next === "reset-password" ? "/reset-password" : "/";
        return NextResponse.redirect(new URL(target, base), { headers: { "Cache-Control": "private, no-store" } });
      }
      console.error("[AUTH_CALLBACK] Session exchange rejected or expired.");
    }
    return NextResponse.redirect(new URL("/login?error=oauth_failed", base));
  } catch (error) { return authError(error, "Sign-in callback failed. Request a new link and open it in the same browser."); }
}
