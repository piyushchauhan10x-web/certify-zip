import { NextResponse } from "next/server";
import { publicAuthConfig } from "@/lib/supabase/config";
import { probeSupabaseAuth, AuthDiagnostics } from "@/lib/supabase/diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const missingEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(name => !process.env[name]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim());
  let diagnostics: AuthDiagnostics = { ok: false, supabaseReachable: false };
  try { diagnostics = await probeSupabaseAuth(publicAuthConfig()); }
  catch { console.error("[HEALTH_CONFIG] Missing or invalid public Supabase configuration."); }
  const ok = !missingEnv.length && diagnostics.ok && diagnostics.googleProviderEnabled !== false;
  return NextResponse.json({ ok, missingEnv, supabaseReachable: diagnostics.supabaseReachable,
    ...(diagnostics.googleProviderEnabled !== undefined ? { googleProviderEnabled: diagnostics.googleProviderEnabled } : {}),
  }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
