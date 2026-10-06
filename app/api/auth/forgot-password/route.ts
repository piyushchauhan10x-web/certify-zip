import { emailLookupPattern } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { authSchema } from "@/lib/validation";
import { getBaseUrl } from "@/lib/oauth";
import { authError, requireEnv } from "@/lib/authErrors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`forgot:${clientKey}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "JWT_SECRET", "RESEND_API_KEY");
    const body = await req.json();
    const parsed = authSchema.pick({ email: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { data: user, error } = await supabase.from("users").select("id").ilike("email", emailLookupPattern(parsed.data.email)).maybeSingle();
    if (error) return authError(error, "Account database is unavailable. Please try again later.");

    if (user) {
      const token = createResetToken(user.id);
      const baseUrl = getBaseUrl(req);
      const resetLink = `${baseUrl}/reset-password?token=${token}`;
      const result = await sendPasswordResetEmail(parsed.data.email, resetLink);
      if (result.error) return NextResponse.json({ error: "Password reset email is not available yet" }, { status: 503 });
    }

    return NextResponse.json({ ok: true, message: "If that email exists, a reset link has been sent." });
  } catch (err) {
    return authError(err, "Password reset email is not available yet");
  }
}

