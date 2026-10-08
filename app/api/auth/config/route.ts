import { NextRequest, NextResponse } from "next/server";
import { publicAuthConfig } from "@/lib/supabase/config";
import { getAppUrl } from "@/lib/appUrl";
import { probeSupabaseAuth } from "@/lib/supabase/diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const config = publicAuthConfig();
    const baseUrl = getAppUrl(req);
    const diagnostics = await probeSupabaseAuth(config);
    if (!diagnostics.ok) return NextResponse.json({ error: diagnostics.error }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ ...config, baseUrl, googleProviderEnabled: diagnostics.googleProviderEnabled }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/^Missing env:/, "Missing config:") : "Auth configuration unavailable.";
    console.error("[AUTH_CONFIG]", message);
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
