import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { authSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`login:${clientKey}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const { data: user, error } = await supabase
      .from("users")
      .select("id, password_hash")
      .eq("email", email)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createSessionToken(user.id);
    const res = NextResponse.json({ ok: true });
    const cookieDomain = process.env.COOKIE_DOMAIN?.trim();
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    });
    return res;
  } catch (err: any) {
    console.error("LOGIN CRASH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
