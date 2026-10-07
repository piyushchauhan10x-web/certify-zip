import type { CookieOptions } from "@supabase/ssr";
export function sessionCookieOptions(options: CookieOptions, remember?: string): CookieOptions {
  // Preserve deletion cookies; otherwise honor the existing Remember me control.
  return remember === "0" && options.maxAge !== 0 ? { ...options, maxAge: undefined, expires: undefined } : options;
}
