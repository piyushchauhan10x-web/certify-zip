import { GmailError } from "./gmail";
import { cleanEnvValue } from "./appUrl";
// Verification uses the provider's domain status, not a flag or an assumed address.
export async function hasVerifiedResendSender(): Promise<boolean> {
  const key = cleanEnvValue(process.env.RESEND_API_KEY);
  const from = cleanEnvValue(process.env.EMAIL_FROM);
  if (!key || !from) return false;
  const email = from.match(/<([^>]+)>/)?.[1] || from;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || domain === "resend.dev") return false;
  const response = await fetch("https://api.resend.com/domains", { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) { console.error("[RESEND_DOMAIN] Could not verify sender domain."); return false; }
  const data = await response.json();
  return Boolean(data.data?.some((d: { name: string; status: string }) => d.name.toLowerCase() === domain && d.status === "verified"));
}
export async function sendCertEmailViaResend(p: { to: string; subject: string; bodyHtml: string; fromName?: string; pdfBuffer: Buffer; attachmentName: string }) {
  const from = cleanEnvValue(process.env.EMAIL_FROM);
  const email = from.match(/<([^>]+)>/)?.[1] || from;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST", signal: AbortSignal.timeout(25000),
    headers: { Authorization: 'Bearer ' + cleanEnvValue(process.env.RESEND_API_KEY), "Content-Type": "application/json" },
    body: JSON.stringify({ from: p.fromName ? p.fromName.replace(/["<>\r\n]/g, '') + ' <' + email + '>' : from,
      to: [p.to], subject: p.subject, html: p.bodyHtml,
      attachments: [{ filename: p.attachmentName, content: p.pdfBuffer.toString("base64") }],
    }),
  });
  if (!response.ok) {
    console.error("[RESEND_SEND] Certificate delivery rejected.");
    if (response.status === 429) throw new GmailError("SEND_QUOTA", 429, "Email sending quota reached. Try later.");
    throw new GmailError("RESEND_UNAVAILABLE", 500, "The fallback sender is unavailable. Connect Gmail or ask the administrator to verify the EMAIL_FROM domain and sender permissions.");
  }
}
