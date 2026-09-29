import { NextRequest, NextResponse } from "next/server";
import { sendCertEmail } from "@/lib/gmail";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { sendRequestSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`send:${clientKey}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Send limit reached. Try again in an hour." }, { status: 429 });
  }

  try {
    const user = await getCurrentUser();
    if (!user || !user.google_access_token || !user.google_refresh_token || !user.google_email) {
      return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = sendRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const { items, fromName } = parsed.data;
    const results: { to: string; ok: boolean; error?: string }[] = [];

    for (const item of items) {
      try {
        await sendCertEmail({
          accessToken: user.google_access_token,
          refreshToken: user.google_refresh_token,
          senderEmail: user.google_email,
          fromName,
          ...item,
        });
        results.push({ to: item.to, ok: true });
      } catch (err: any) {
        console.error("SEND ITEM FAILED:", item.to, err.message);
        results.push({ to: item.to, ok: false, error: "Failed to send" });
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    console.error("SEND ROUTE CRASH:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
