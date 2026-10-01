import { Resend } from "resend";

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

