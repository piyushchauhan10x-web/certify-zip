import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/appUrl";
import { authError } from "@/lib/authErrors";
import { authMessage } from "@/lib/authUi";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try {
    const base = getAppUrl(req);
    const failed = (message: string) => {
      const target = new URL("/login", base);
      target.searchParams.set("error", "oauth_failed");
      target.searchParams.set("message", message);
      return NextResponse.redirect(target, { headers: { "Cache-Control": "private, no-store" } });
    };
    if (req.nextUrl.searchParams.has("error")) {
      console.error("[AUTH_CALLBACK_PROVIDER] Provider rejected or cancelled authentication.");
      return failed(authMessage({ message: req.nextUrl.searchParams.get("error_description") || "Google sign-in was cancelled or denied." }));
    }
    const code = req.nextUrl.searchParams.get("code");
    if (code) {
      const { error } = await createClient().auth.exchangeCodeForSession(code);
      if (!error) {
        const next = req.nextUrl.searchParams.get("next");
        const target = next === "/reset-password" || next === "reset-password" ? "/reset-password" : "/";
        return NextResponse.redirect(new URL(target, base), { headers: { "Cache-Control": "private, no-store" } });
      }
      const message = authMessage(error);
      console.error("[AUTH_CALLBACK_EXCHANGE]", message);
      return failed(message);
    }
    console.error("[AUTH_CALLBACK_CODE] No authorization code was supplied.");
    return failed("No authorization code was supplied. Start sign-in again, or request a new password-reset link.");
  } catch (error) { return authError(error, "Sign-in callback failed. Request a new link and open it in the same browser."); }
}
