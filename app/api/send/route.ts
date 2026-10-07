import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { sendCertEmail, GmailError, getGmailConnection } from "@/lib/gmail";
import { hasVerifiedResendSender, sendCertEmailViaResend } from "@/lib/email";
import { AppConfigurationError } from "@/lib/appUrl";
import { checkRateLimit } from "@/lib/rateLimit";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const schema = z.object({
  path: z.string().max(150), to: z.string().trim().email(), name: z.string().max(300).optional(),
  subject: z.string().trim().min(1).max(500).refine(s => !/[\r\n]/.test(s)),
  message: z.string().max(20000).optional(), fromName: z.string().max(200).refine(s => !/[\r\n]/.test(s)).optional(),
}).strict();
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export async function POST(req: NextRequest) {
  let storagePath = "";
  let step = "authenticate";
  const fail = (code: string, error: string, status: number) => {
    console.error("[SEND_ERROR]", { step, code, message: error });
    return NextResponse.json({ code, error }, { status });
  };
  try {
    const user = await getCurrentUser();
    if (!user) return fail("LOGIN_REQUIRED", "Please log in and connect Gmail.", 401);
    step = "validate";
    const text = await req.text();
    if (text.length > 30000) return fail("INVALID_PAYLOAD", "Send only the storage path and email details; upload the PDF directly to storage.", 400);
    const parsed = schema.safeParse(JSON.parse(text));
    if (!parsed.success) return fail("INVALID_PAYLOAD", "Enter a valid recipient email, subject and certificate path. Message limit: 20,000 characters.", 400);
    const { path, to, name, subject, message, fromName } = parsed.data;
    if (!path.startsWith(user.id + "/") || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(path)) return fail("INVALID_PATH", "This certificate does not belong to your account.", 400);
    storagePath = path;
    if (!checkRateLimit('send:' + user.id, 50, 60 * 60 * 1000)) return fail("SEND_QUOTA", "Send limit reached. Try again later.", 429);
    step = "sender_connection";
    const connection = await getGmailConnection(user.id);
    // An existing/revoked connection must never silently switch sender accounts.
    const fallback = !connection && await hasVerifiedResendSender();
    if (!connection && !fallback) return fail("RECONNECT_GMAIL", "Connect Gmail to send certificates, or ask the administrator to configure a verified EMAIL_FROM domain and RESEND_API_KEY.", 401);
    step = "download";
    const { data, error } = await supabase.storage.from("certificates").download(path);
    if (error || !data) return fail("PDF_DOWNLOAD_FAILED", "Could not download the certificate. Upload it again and retry.", 500);
    if (data.size > 20 * 1024 * 1024) return fail("PDF_TOO_LARGE", "The certificate exceeds the 20 MB attachment limit.", 400);
    const pdfBuffer = Buffer.from(await data.arrayBuffer());
    if (pdfBuffer.subarray(0, 5).toString() !== "%PDF-") return fail("INVALID_PDF", "The uploaded file is not a PDF.", 400);
    const bodyHtml = '<p>' + escape(message || ('Hi ' + (name || 'there') + ', please find your certificate attached.')).replace(/\n/g, '<br>') + '</p>';
    const attachmentName = 'certificate_' + (name || 'recipient').replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    const payload = { to, subject, bodyHtml, fromName, pdfBuffer, attachmentName };
    step = "send";
    if (connection) await sendCertEmail({ ...payload, user: connection });
    else await sendCertEmailViaResend(payload);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof GmailError) return fail(error.code, error.message, error.status);
    if (error instanceof SyntaxError) return fail("INVALID_PAYLOAD", "Invalid JSON request.", 400);
    if (error instanceof AppConfigurationError || (error instanceof Error && error.message.startsWith("Missing env:"))) return fail("SERVER_CONFIGURATION", error.message, 500);
    return fail("SEND_FAILED", step === "send" ? "Delivery could not be confirmed. Check Sent mail before retrying to avoid duplicates." : "Could not prepare the certificate email. Please try again.", 500);
  } finally {
    if (storagePath) {
      try {
        const { error } = await supabase.storage.from("certificates").remove([storagePath]);
        if (error) console.error("[STORAGE_CLEANUP] Temporary PDF deletion failed.");
      } catch { console.error("[STORAGE_CLEANUP] Temporary PDF deletion failed."); }
    }
  }
}
