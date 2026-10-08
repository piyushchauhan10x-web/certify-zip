import type { SupabaseClient } from "@supabase/supabase-js";

export async function withAuthTimeout<T>(operation: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Request timed out. Please try again.")), 30000);
      }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}

export function authMessage(error: { code?: string; message: string }) {
  if (/provider.*not enabled|unsupported provider/i.test(error.message)) return "Supabase Google provider is not enabled";
  if (["over_email_send_rate_limit", "over_request_rate_limit"].includes(error.code || "")) return "Too many emails, try later";
  if (error.code === "invalid_credentials") return "Incorrect email or password.";
  if (["user_already_exists", "email_exists"].includes(error.code || "")) return "An account with this email already exists. Please sign in.";
  if (error.code === "weak_password") return "Choose a stronger password with at least 6 characters.";
  if (error.code === "email_not_confirmed") return "Confirm your email before signing in.";
  return safeAuthMessage(error.message);
}

export function authException(error: unknown) {
  return error instanceof Error ? authMessage(error) : "Authentication failed without an error message. Please retry.";
}

export function safeAuthMessage(message: string) {
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, "[service URL]")
    .replace(/\b(?:eyJ[\w.-]+|sb_(?:secret|publishable)_[\w-]+|ya29\.[\w.-]+)\b/g, "[redacted]")
    .replace(/((?:access_token|refresh_token|id_token|client_secret|authorization|password|code_verifier)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]").slice(0, 1000);
}
export function authFailure(step: string, error: unknown) {
  const message = authException(error);
  console.error('[' + step + ']', message);
  return message;
}
// The SDK builds a PKCE URL here. There is no network/redirect race timer.
export async function redirectToGoogle(client: SupabaseClient, redirectTo: string, navigate: (url: string) => void) {
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google", options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Supabase did not return a Google sign-in URL.");
  navigate(data.url);
}
