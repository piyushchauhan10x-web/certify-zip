import { emailLookupPattern } from "@/lib/validation";
import { authCookieOptions } from "@/lib/oauth";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { verifyPassword, createSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { authSchema } from "@/lib/validation";
import { authError, requireEnv } from "@/lib/authErrors";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`login:${clientKey}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
  }

  try {
    requireEnv("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "JWT_SECRET");
    const body = await req.json();
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const { data: user, error } = await supabase
      .from("users")
      .select("id, password_hash")
      .ilike("email", emailLookupPattern(email))
      .maybeSingle();

    if (error) return authError(error, "Account database is unavailable. Please try again later.");
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = typeof user.password_hash === "string" && /^\$2[aby]\$/.test(user.password_hash) && await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createSessionToken(user.id);
    const res = NextResponse.json({ ok: true });

    res.cookies.set("session", token, {
      ...authCookieOptions(req),
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return authError(err, "Login failed. Please try again later.");
  }
}
