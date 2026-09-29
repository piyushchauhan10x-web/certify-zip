import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { verifyResetToken, hashPassword } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`reset:${clientKey}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const { token, password } = await req.json();
    if (!token || !password || password.length < 6) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const payload = verifyResetToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Reset link expired or invalid" }, { status: 400 });
    }

    const password_hash = await hashPassword(password);
    const { error } = await supabase.from("users").update({ password_hash }).eq("id", payload.userId);

    if (error) {
      return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("RESET PASSWORD ERROR:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
