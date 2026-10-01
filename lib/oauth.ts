import { NextRequest } from "next/server";

export function getBaseUrl(req?: NextRequest): string {
  const envFrontend = process.env.FRONTEND_URL || process.env.APP_URL;
  if (envFrontend && envFrontend.trim()) {
    const trimmed = envFrontend.trim().replace(/\/+$/, "");
    if (process.env.NODE_ENV === "production" && (trimmed.includes("localhost") || trimmed.includes("127.0.0.1"))) {
      // Ignore misconfigured localhost env in production
    } else {
      return trimmed;
    }
  }

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const hostHeader = req.headers.get("host");
    const rawHost = (forwardedHost || hostHeader || "").split(",")[0].trim();

    if (rawHost) {
      const isProd = process.env.NODE_ENV === "production";
      if (!isProd || (!rawHost.includes("localhost") && !rawHost.includes("127.0.0.1"))) {
        const proto = req.headers.get("x-forwarded-proto") || (isProd ? "https" : "http");
        const scheme = isProd ? "https" : proto;
        return `${scheme}://${rawHost}`;
      }
    }
  }

  if (process.env.NODE_ENV === "production") {
    return "https://certify-zip.vercel.app";
  }

  return "http://localhost:3000";
}

export function getRedirectUri(req?: NextRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.trim()) {
    const trimmed = process.env.GOOGLE_REDIRECT_URI.trim();
    if (process.env.NODE_ENV === "production" && (trimmed.includes("localhost") || trimmed.includes("127.0.0.1"))) {
      // Ignore localhost redirect URI in production
    } else {
      return trimmed;
    }
  }

  const baseUrl = getBaseUrl(req);
  return `${baseUrl}/api/auth/google/callback`;
}

export const GOOGLE_OAUTH_CONFIG = {
  get clientId() {
    return (process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  },
  get clientSecret() {
    return (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  },
  get redirectUri() {
    return getRedirectUri();
  },
  scopes: [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ],
};

export function buildAuthUrl(state: string, req?: NextRequest): string {
  const clientId = GOOGLE_OAUTH_CONFIG.clientId;
  if (!clientId) {
    console.error("[OAUTH ERROR] GOOGLE_CLIENT_ID or NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in environment variables!");
  }

  const redirectUri = getRedirectUri(req);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

