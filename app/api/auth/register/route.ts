import { authCookieOptions } from "@/lib/oauth";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { hashPassword, createSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { authSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`register:${clientKey}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password (min 6 chars)" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const { data: existing } = await supabase.from("users").select("id").eq("email", email).single();
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const password_hash = await hashPassword(password);
    const { data, error } = await supabase
      .from("users")
      .insert({ email, password_hash })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Registration failed" }, { status: 500 });
    }

    const token = createSessionToken(data.id);
    const res = NextResponse.json({ ok: true });

    res.cookies.set("session", token, {
      ...authCookieOptions(req),
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err: any) {
    console.error("REGISTER CRASH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
