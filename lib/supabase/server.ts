import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicAuthConfig } from "./config";
import { sessionCookieOptions } from "../sessionCookies";
import { timedFetch } from "../http";

export function createClient() {
  const store = cookies();
  const { url, key } = publicAuthConfig();
  return createServerClient(url, key, {
    global: { fetch: timedFetch },
    cookieOptions: { secure: process.env.NODE_ENV === "production" },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, sessionCookieOptions(options, store.get("certify_remember")?.value))); }
        catch { console.error("[SESSION_COOKIE] Cookie write unavailable; middleware must refresh the session."); }
      },
    },
  });
}
