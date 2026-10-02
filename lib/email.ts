import { Resend } from "resend";
import { google } from "googleapis";
import { GOOGLE_OAUTH_CONFIG } from "./oauth";
import { supabase } from "./db";

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "re_placeholder") {
    console.error("[RESEND_ERROR] RESEND_API_KEY environment variable is not configured or is a placeholder!");
    return { error: new Error("RESEND_API_KEY environment variable is missing.") };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: "Certify <onboarding@resend.dev>",
      to,
      subject: "Reset your Certify password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>Click the link below to reset your Certify password. This link expires in 30 minutes.</p>
          <a href="${resetLink}" style="display:inline-block;background:#6C63FF;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;margin-top:12px;">Reset Password</a>
          <p style="color:#888;font-size:13px;margin-top:20px;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    if (result.error) {
      console.error("[RESEND_API_ERROR] Failed to send password reset email:", result.error);
    } else {
      console.log("[RESEND_SUCCESS] Reset email sent to:", to, "ID:", result.data?.id);
    }
    return result;
  } catch (err: any) {
    console.error("[RESEND_EXCEPTION] Exception thrown while sending reset email:", err?.message || err);
    return { error: err };
  }
}

interface SendCertParams {
  to: string;
  subject: string;
  bodyHtml: string;
  fromName?: string;
  pdfBuffer: Buffer;
  attachmentName: string;
}

export async function sendCertEmailViaResend(p: SendCertParams) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "re_placeholder") {
    console.error("[RESEND_ERROR] RESEND_API_KEY environment variable is missing!");
    throw new Error("RESEND_API_KEY environment variable is missing.");
  }

  const resend = new Resend(apiKey);
  const defaultFrom = process.env.EMAIL_FROM || "Certify <onboarding@resend.dev>";

  let fromHeader = defaultFrom;
  if (p.fromName) {
    const emailMatch = defaultFrom.match(/<([^>]+)>/);
    const emailAddr = emailMatch ? emailMatch[1] : defaultFrom;
    fromHeader = `${p.fromName} <${emailAddr}>`;
  }

  const result = await resend.emails.send({
    from: fromHeader,
    to: p.to,
    subject: p.subject,
    html: p.bodyHtml,
    attachments: [
      {
        filename: p.attachmentName,
        content: p.pdfBuffer,
      },
    ],
  });

  if (result.error) {
    console.error("[RESEND_API_ERROR] Failed to send certificate email:", result.error);
    throw new Error(result.error.message || "Resend API error");
  }

  return result;
}

interface SendCertGmailParams {
  accessToken: string;
  refreshToken: string;
  senderEmail: string;
  fromName?: string;
  to: string;
  subject: string;
  bodyHtml: string;
  pdfBuffer: Buffer;
  attachmentName: string;
}

export async function sendCertEmailViaGmail(p: SendCertGmailParams) {
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
      console.log("[GMAIL_TOKEN_REFRESH] Refreshed Google access token");
      await supabase
        .from("users")
        .update({ google_access_token: tokens.access_token })
        .eq("google_refresh_token", p.refreshToken);
    }
  });

  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const boundary = "cert_boundary_" + Date.now();

    const fromHeader = p.fromName ? `${p.fromName} <${p.senderEmail}>` : p.senderEmail;
    const attachmentBase64 = p.pdfBuffer.toString("base64");

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
      attachmentBase64,
      `--${boundary}--`,
    ].join("\r\n");

    const encodedMessage = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    console.log("[GMAIL_SUCCESS] Email sent via Gmail API to:", p.to, "ID:", response.data.id);
    return response.data;
  } catch (err: any) {
    console.error("[GMAIL_API_ERROR] Failed to send email via Gmail API:", err?.message || err);
    throw new Error(err?.message || "Gmail API error");
  }
}


