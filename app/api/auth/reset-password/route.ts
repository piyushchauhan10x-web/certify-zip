import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { verifyResetToken, hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { authSchema } from "@/lib/validation";
import { authError, requireEnv } from "@/lib/authErrors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`reset:${clientKey}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "JWT_SECRET");
    const body = await req.json();
    if (!body || typeof body !== "object" || typeof body.token !== "string" || !body.token || !authSchema.shape.password.safeParse(body.password).success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { token, password } = body;

    const payload = verifyResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Reset link expired or invalid" }, { status: 400 });
    }

    const password_hash = await hashPassword(password);
    const { data, error } = await supabase.from("users").update({ password_hash }).eq("id", payload.userId).select("id").maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return authError(err, "Could not reset your password. Please try again.");
  }
}
