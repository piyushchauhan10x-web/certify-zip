import { google } from "googleapis";
import { GOOGLE_OAUTH_CONFIG } from "./oauth";
import { supabase } from "./db";

interface SendParams {
  accessToken: string;
  refreshToken: string;
  senderEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  bodyHtml: string;
  attachmentBase64: string;
  attachmentName: string;
}

export async function sendCertEmail(p: SendParams) {
  if (!GOOGLE_OAUTH_CONFIG.clientId || !GOOGLE_OAUTH_CONFIG.clientSecret) {
    console.error("[GMAIL_SEND_ERROR] GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variable is missing on server!");
    throw new Error("Server is missing Google OAuth client credentials.");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
  oauth2Client.setCredentials({
    access_token: p.accessToken,
    refresh_token: p.refreshToken,
  });

  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await supabase
        .from("users")
        .update({ google_access_token: tokens.access_token })
        .eq("google_refresh_token", p.refreshToken);
    }
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const boundary = "cert_boundary_" + Date.now();

  const fromHeader = p.fromName ? `${p.fromName} <${p.senderEmail}>` : p.senderEmail;

  const raw = [
    `From: ${fromHeader}`,
    `To: ${p.to}`,
    `Subject: ${p.subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "",
    p.bodyHtml,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${p.attachmentName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${p.attachmentName}"`,
    "",
    p.attachmentBase64,
    `--${boundary}--`,
  ].join("\r\n");

  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: encodedMessage },
  });
}
