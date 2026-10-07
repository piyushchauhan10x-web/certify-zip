import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { publicAuthConfig } from "./lib/supabase/config";
import { sessionCookieOptions } from "./lib/sessionCookies";
import { timedFetch } from "./lib/http";
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isPublic = ["/login", "/signup", "/register", "/forgot-password", "/privacy", "/terms"].includes(path) || path.startsWith("/auth/");
  if (isPublic) return response;
  try {
    const { url, key } = publicAuthConfig();
    const supabase = createServerClient(url, key, {
      global: { fetch: timedFetch },
      cookieOptions: { secure: process.env.NODE_ENV === "production" },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options, request.cookies.get("certify_remember")?.value)));
        },
      },
    });
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user) {
      const target = request.nextUrl.clone();
      target.pathname = "/login";
      target.search = error && error.status !== 400 && error.status !== 401 ? "?error=session_check" : "";
      const redirect = NextResponse.redirect(target);
      response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
      return redirect;
    }
  } catch {
    console.error("[SESSION_REFRESH] Authentication configuration or network unavailable.");
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "?error=session_check";
    return NextResponse.redirect(target);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/((?!api|_next|favicon.ico|.*\\.[^/]+$).*)"] };
