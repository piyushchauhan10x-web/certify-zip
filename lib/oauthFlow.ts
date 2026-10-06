import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { authCookieOptions, getGoogleLoginConfig } from "./appUrl";
import { requireEnv } from "./authErrors";
import { GMAIL_SEND_SCOPE } from "./oauth";

type Flow = "google" | "gmail";
type Context = { purpose: string; state: string; redirectUri: string; userId?: string };
export function startOAuth(req: NextRequest, flow: Flow, userId?: string) {
  requireEnv("JWT_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_KEY");
  const config = getGoogleLoginConfig(req);
  const redirectUri = flow === "google" ? config.redirectUri : `${config.baseUrl}/api/auth/gmail/callback`;
  const origin = new URL(redirectUri).origin;
  const path = flow === "google" ? "/api/auth/google" : "/api/auth/gmail/connect";
  if (req.nextUrl.origin !== origin) {
    const url = new URL(path, origin);
    if (req.nextUrl.searchParams.get("format") === "json") return NextResponse.json({ url: url.toString() });
    return NextResponse.redirect(url);
  }
  const state = randomBytes(32).toString("hex");
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, response_type: "code", state,
    scope: flow === "google" ? "openid email profile" : `openid email profile ${GMAIL_SEND_SCOPE} https://www.googleapis.com/auth/spreadsheets.readonly`,
    ...(flow === "gmail" ? { access_type: "offline", prompt: "consent", include_granted_scopes: "true" } : {}),
  });
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  const response = req.nextUrl.searchParams.get("format") === "json" ? NextResponse.json({ url }) : NextResponse.redirect(url);
  const context = jwt.sign({ purpose: flow, state, redirectUri, userId }, process.env.JWT_SECRET!.trim(), { expiresIn: "10m" });
  response.cookies.set(`${flow}_oauth_state`, context, { ...authCookieOptions(), maxAge: 600 });
  return response;
}
export function readOAuthContext(req: NextRequest, flow: Flow): Context | null {
  requireEnv("JWT_SECRET");
  try {
    const context = jwt.verify(req.cookies.get(`${flow}_oauth_state`)?.value || "", process.env.JWT_SECRET!.trim(), { algorithms: ["HS256"] }) as Context;
    const state = Buffer.from(req.nextUrl.searchParams.get("state") || "");
    const expected = Buffer.from(context.state || "");
    if (context.purpose !== flow || !state.length || state.length !== expected.length || !timingSafeEqual(state, expected)) return null;
    return context;
  } catch { return null; }
}
