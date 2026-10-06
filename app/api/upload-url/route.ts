import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`upload_url:${clientKey}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ code: "SEND_QUOTA", error: "Too many upload requests. Slow down." }, { status: 429 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ code: "NOT_AUTHENTICATED", error: "Please log in and connect Gmail." }, { status: 401 });
    }

    const filename = `${nanoid(24)}.pdf`;
    const { data, error } = await supabase.storage
      .from("certificates")
      .createSignedUploadUrl(filename);

    if (error || !data) {
      console.error("[UPLOAD_URL_ERROR] Failed to create signed upload URL.");
      return NextResponse.json(
        { error: "Failed to generate upload URL. Check the certificates bucket configuration." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      path: data.path,
      signedUrl: data.signedUrl,
      token: data.token,
    });
  } catch {
    console.error("[UPLOAD_URL_CRASH] Could not create signed upload URL.");
    return NextResponse.json({ error: "Server error generating upload URL" }, { status: 500 });
  }
}
