import { cleanEnvValue, getAppUrl, getGoogleRedirectUri, authCookieOptions } from "./appUrl";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export { getAppUrl as getBaseUrl, getGoogleRedirectUri as getRedirectUri, authCookieOptions };
export const GOOGLE_OAUTH_CONFIG = {
  get clientId() { return cleanEnvValue(process.env.GOOGLE_CLIENT_ID); },
  get clientSecret() { return cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET); },
  get redirectUri() { return getGoogleRedirectUri(); },
  scopes: ["openid", "email", "profile"],
};
