import { publicAuthConfig } from "./config";

export type AuthDiagnostics = {
  ok: boolean;
  supabaseReachable: boolean;
  googleProviderEnabled?: boolean;
  error?: string;
};

// Auth settings is a public endpoint. Only booleans leave this probe; never log
// the URL, apikey header, response body, or a raw transport exception.
export async function probeSupabaseAuth(config: ReturnType<typeof publicAuthConfig>): Promise<AuthDiagnostics> {
  const signal = AbortSignal.timeout(5000);
  let reachable = false;
  try {
    const response = await fetch(`${config.url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: config.key }, cache: "no-store", signal,
    });
    reachable = true;
    if (!response.ok) {
      const error = response.status === 401 || response.status === 403
        ? "Supabase rejected NEXT_PUBLIC_SUPABASE_ANON_KEY. Check that it belongs to NEXT_PUBLIC_SUPABASE_URL."
        : `Supabase Auth settings returned HTTP ${response.status}. Check NEXT_PUBLIC_SUPABASE_URL and the Supabase project status.`;
      console.error("[SUPABASE_SETTINGS]", error);
      return { ok: false, supabaseReachable: true, error };
    }
    const settings = await response.json();
    const googleProviderEnabled = typeof settings?.external?.google === "boolean" ? settings.external.google : undefined;
    if (googleProviderEnabled === false) console.error("[SUPABASE_GOOGLE_PROVIDER] Supabase Google provider is not enabled.");
    return { ok: true, supabaseReachable: true, ...(googleProviderEnabled !== undefined ? { googleProviderEnabled } : {}) };
  } catch (error) {
    const message = signal.aborted ? "Supabase Auth health check timed out after 5 seconds. Please retry."
      : error instanceof SyntaxError ? "Supabase Auth settings returned an invalid JSON response."
      : error instanceof TypeError ? "Network error reaching Supabase" : "Supabase Auth settings check failed.";
    console.error("[SUPABASE_SETTINGS]", message);
    return { ok: false, supabaseReachable: reachable, error: message };
  }
}
