import { NextRequest, NextResponse } from "next/server";
import { publicAuthConfig } from "@/lib/supabase/config";
import { getAppUrl } from "@/lib/appUrl";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({ ...publicAuthConfig(), baseUrl: getAppUrl(req) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth configuration unavailable.";
    console.error("[AUTH_CONFIG]", message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
