const getRedirectUri = () => {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  if (process.env.APP_URL) return `${process.env.APP_URL}/api/auth/google/callback`;
  return "https://certify-zip.vercel.app/api/auth/google/callback";
};

export const GOOGLE_OAUTH_CONFIG = {
  get clientId() {
    return process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  },
  get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || "";
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

export function buildAuthUrl(state: string): string {
  const clientId = GOOGLE_OAUTH_CONFIG.clientId;
  if (!clientId) {
    console.error("[OAUTH ERROR] GOOGLE_CLIENT_ID or NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured in environment variables!");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_CONFIG.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
