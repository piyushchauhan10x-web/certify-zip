import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { AppConfigurationError, getAppUrl, getGoogleRedirectUri, cleanEnvValue } from "./appUrl";
import { requireEnv } from "./authErrors";
import { getSupabase } from "./db";
import { startOAuth } from "./oauthFlow";

// Preserve useful error messages/stacks without logging environment values or
// upstream URLs, which can contain credentials, codes, or tokens.
function safeDiagnostic(value: string) {
  for (const envValue of Object.values(process.env)) {
    const cleaned = cleanEnvValue(envValue);
    if (cleaned.length >= 4) value = value.split(cleaned).join("[REDACTED]");
  }
  return value
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[REDACTED_URL]")
    .replace(/\b(?:Bearer\s+\S+|eyJ[\w.-]+|ya29\.[\w.-]+)\b/gi, "[REDACTED_TOKEN]")
    .replace(/((?:access_token|refresh_token|id_token|client_secret|authorization|code|state)\s*[=:]\s*)[^\s,;]+/gi, "$1[REDACTED]");
}

export async function startGoogleConnection(req: NextRequest) {
  let step = "user_lookup";
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "LOGIN_REQUIRED", error: "Please log in before connecting Gmail." }, { status: 401 });
    step = "env";
    requireEnv("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SUPABASE_SERVICE_KEY");
    const clientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
    const clientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
    if (!clientId || !clientSecret) throw new AppConfigurationError(`Missing env: ${!clientId ? "GOOGLE_CLIENT_ID" : "GOOGLE_CLIENT_SECRET"}`);
    // Read the canonical URL at request time.
    const baseUrl = getAppUrl(req);
    step = "redirect_uri";
    const redirectUri = getGoogleRedirectUri(req);
    // Validation guarantees this URL has no credentials, query, or fragment.
    console.error("[AUTH_DIAGNOSTIC]", { step, redirect_uri: redirectUri });
    step = "database";
    const { error } = await getSupabase().from("gmail_tokens").select("user_id").eq("user_id", user.id).limit(1);
    if (error) throw new Error(error.message);
    step = "state_cookie";
    return startOAuth(req, user.id, { clientId, clientSecret, baseUrl, redirectUri });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[AUTH_ERROR]", { step, message: safeDiagnostic(message), stack: stack ? safeDiagnostic(stack) : undefined });
    return NextResponse.json({ error: safeDiagnostic(message), step }, { status: 500 });
  }
}
