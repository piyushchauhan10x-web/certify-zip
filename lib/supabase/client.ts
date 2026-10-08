import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { request, authFetch } from "@/lib/http";

import { sessionCookieOptions } from "../sessionCookies";

type Config = { url: string; key: string; baseUrl: string; googleProviderEnabled?: boolean };
let config: Promise<Config> | undefined;
export function getAuthConfig(refresh = false) {
  if (refresh) config = undefined;
  return config ||= request<Config>("/api/auth/config").catch(error => { console.error("[AUTH_CONFIG] Public authentication configuration unavailable."); config = undefined; throw error; });
}
export async function createClient(remember?: boolean) {
  const { url, key } = await getAuthConfig();
  const secure = window.location.protocol === "https:";
  if (remember !== undefined) document.cookie = serializeCookieHeader("certify_remember", remember ? "1" : "0", { path: "/", sameSite: "lax", secure, ...(remember ? { maxAge: 31536000 } : {}) });
  return createBrowserClient(url, key, {
    global: { fetch: authFetch }, cookieOptions: { secure },
    cookies: {
      getAll: () => parseCookieHeader(document.cookie).map(c => ({ name: c.name, value: c.value || "" })),
      setAll(values) {
        const preference = parseCookieHeader(document.cookie).find(c => c.name === "certify_remember")?.value;
        values.forEach(({ name, value, options }) => { document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(options, preference)); });
      },
    },
  });
}
