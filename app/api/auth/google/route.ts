import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ error: "Google login has moved. Open /login and choose Continue with Google.", code: "USE_SUPABASE_LOGIN" }, { status: 410 });
}
