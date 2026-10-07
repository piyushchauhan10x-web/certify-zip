import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const missingEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(name => !process.env[name]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim());
  return NextResponse.json({ ok: !missingEnv.length, missingEnv }, { status: missingEnv.length ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
