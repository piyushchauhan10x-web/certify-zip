import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { sendCertEmailViaResend } from "@/lib/email";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { z } from "zod";

export const maxDuration = 60;

const sendPayloadSchema = z.object({
  path: z.string().min(1),
  to: z.string().email(),
  name: z.string().optional(),
  subject: z.string().min(1),
  message: z.string().optional(),
  bodyHtml: z.string().optional(),
  fromName: z.string().optional(),
  attachmentName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`send:${clientKey}`, 50, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Send limit reached. Try again later." }, { status: 429 });
  }

  let recipientEmail = "";
  let storagePath = "";

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = sendPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload format" }, { status: 400 });
    }

    const { path, to, name, subject, message, bodyHtml, fromName, attachmentName } = parsed.data;
    recipientEmail = to;
    storagePath = path;

    // 1. Download certificate PDF from private Supabase Storage "certificates" bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("certificates")
      .download(path);

    if (downloadError || !fileData) {
      console.error("[SEND_DOWNLOAD_ERROR]", { step: "download", recipient: to, path, error: downloadError?.message });
      return NextResponse.json(
        { error: `Failed to fetch certificate from storage: ${downloadError?.message || "File not found"}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // 2. Format HTML email body
    const html = bodyHtml || message || `<p>Hi ${name || "there"},</p><p>Please find your certificate attached.</p>`;

    // 3. Dispatch full-quality PDF attachment via Resend
    await sendCertEmailViaResend({
      to,
      subject,
      bodyHtml: html,
      fromName,
      pdfBuffer,
      attachmentName: attachmentName || `certificate_${(name || "recipient").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
    });

    // 4. Delete temporary storage file after successful email delivery
    const { error: removeError } = await supabase.storage
      .from("certificates")
      .remove([path]);

    if (removeError) {
      console.error("[SEND_CLEANUP_WARNING]", { step: "delete_after_send", recipient: to, path, error: removeError.message });
    }

    return NextResponse.json({ ok: true, recipient: to });
  } catch (err: any) {
    console.error("[SEND_ROUTE_CRASH]", {
      step: "send_catch",
      recipient: recipientEmail,
      path: storagePath,
      message: err?.message || err,
    });

    if (storagePath) {
      try {
        await supabase.storage.from("certificates").remove([storagePath]);
      } catch (cleanupErr) {
        console.error("[CLEANUP_ERROR]", cleanupErr);
      }
    }

    return NextResponse.json(
      { error: err?.message || "Failed to send email" },
      { status: 500 }
    );
  }
}

