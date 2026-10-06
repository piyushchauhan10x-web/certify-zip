import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const base = getAppUrl(req);
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const { error } = await createClient().auth.exchangeCodeForSession(code);
      if (!error) {
        const target = req.nextUrl.searchParams.get("next") === "reset-password" ? "/reset-password" : "/";
        const response = NextResponse.redirect(new URL(target, base));
        response.headers.set("Cache-Control", "private, no-store");
        return response;
      }
    } catch { /* Never log authorization codes or provider exceptions. */ }
  }
  return NextResponse.redirect(new URL("/login?error=oauth_failed", base));
}
