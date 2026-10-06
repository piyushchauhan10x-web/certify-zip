import { NextRequest } from "next/server";
import { cleanEnvValue, getAppUrl, getGoogleRedirectUri, authCookieOptions, getGoogleLoginConfig, GoogleLoginConfig } from "./appUrl";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export { getAppUrl as getBaseUrl, getGoogleRedirectUri as getRedirectUri, authCookieOptions };
export const GOOGLE_OAUTH_CONFIG = {
  get clientId() { return cleanEnvValue(process.env.GOOGLE_CLIENT_ID); },
  get clientSecret() { return cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET); },
  get redirectUri() { return getGoogleRedirectUri(); },
  scopes: ["openid", "email", "profile"],
};
export function buildAuthUrl(state: string, req: NextRequest, config: GoogleLoginConfig = getGoogleLoginConfig(req)): string {
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: GOOGLE_OAUTH_CONFIG.scopes.join(" "), state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}
