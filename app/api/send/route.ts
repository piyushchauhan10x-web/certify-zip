import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { sendCertEmail, GmailError, gmailConnected } from "@/lib/gmail";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 60;
const sendPayloadSchema = z.object({
  path: z.string().regex(/^[A-Za-z0-9_-]+\.pdf$/), to: z.string().email(), name: z.string().optional(),
  subject: z.string().min(1).refine(s => !/[\r\n]/.test(s)), message: z.string().optional(), bodyHtml: z.string().optional(), fromName: z.string().optional(), attachmentName: z.string().optional(),
});
export async function POST(req: NextRequest) {
  let recipient = "unknown";
  let storagePath = "";
  let step = "authenticate";
  const fail = (code: string, error: string, status: number) => {
    console.error("[SEND_ERROR]", { step, recipient, code });
    return NextResponse.json({ code, error }, { status });
  };
  try {
    const user = await getCurrentUser(true);
    if (!user) return fail("NOT_AUTHENTICATED", "Please log in and connect Gmail.", 401);
    step = "validate";
    let body;
    try { body = await req.json(); } catch { return fail("INVALID_PAYLOAD", "Invalid JSON request.", 400); }
    const parsed = sendPayloadSchema.safeParse(body);
    if (!parsed.success) return fail("INVALID_PAYLOAD", "Invalid request payload format.", 400);
    const { path, to, name, subject, message, bodyHtml, fromName, attachmentName } = parsed.data;
    recipient = to;
    storagePath = path;
    step = "rate_limit";
    if (!checkRateLimit(`send:${user.id}:${getClientKey(req)}`, 50, 60 * 60 * 1000)) return fail("SEND_QUOTA", "Send limit reached. Try again later.", 429);
    step = "sender_connection";
    // Partial or expired Gmail connections must reconnect, never switch accounts.
    if (!gmailConnected(user)) return fail("RECONNECT_GMAIL", "Gmail not connected. Connect Gmail to send from your account.", 401);
    step = "download";
    const { data, error } = await supabase.storage.from("certificates").download(path);
    if (error || !data) return fail("PDF_DOWNLOAD_FAILED", "Failed to download the certificate from storage.", 500);
    const pdfBuffer = Buffer.from(await data.arrayBuffer());
    const html = bodyHtml || message || `<p>Hi ${name || "there"},</p><p>Please find your certificate attached.</p>`;
    const filename = attachmentName || `certificate_${(name || "recipient").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
    step = "gmail_send";
    await sendCertEmail({ user, to, subject, bodyHtml: html, fromName, pdfBuffer, attachmentName: filename });
    return NextResponse.json({ ok: true, recipient: to });
  } catch (err) {
    if (err instanceof GmailError) return fail(err.code, err.message, err.status);
    // Do not log provider exceptions: they can include Authorization headers.
    return fail("SEND_FAILED", "Could not send the certificate. Try again later.", 500);
  } finally {
    if (storagePath) {
      try {
        const { error } = await supabase.storage.from("certificates").remove([storagePath]);
        if (error) console.error("[SEND_ERROR]", { step: "cleanup", recipient, code: "STORAGE_CLEANUP_FAILED" });
      } catch {
        console.error("[SEND_ERROR]", { step: "cleanup", recipient, code: "STORAGE_CLEANUP_FAILED" });
      }
    }
  }
}
