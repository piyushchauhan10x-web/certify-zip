import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { createResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { authSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`forgot:${clientKey}`, 3, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = authSchema.pick({ email: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { data: user } = await supabase.from("users").select("id").eq("email", parsed.data.email).single();

    if (user) {
      const token = createResetToken(user.id);
      const resetLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
      await sendPasswordResetEmail(parsed.data.email, resetLink);
    }

    return NextResponse.json({ ok: true, message: "If that email exists, a reset link has been sent." });
  } catch (err: any) {
    console.error("FORGOT PASSWORD ERROR:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
