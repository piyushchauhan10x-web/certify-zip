import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/db";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { randomUUID } from "crypto";
import { authError } from "@/lib/authErrors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`upload_url:${clientKey}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ code: "SEND_QUOTA", error: "Too many upload requests. Slow down." }, { status: 429 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ code: "LOGIN_REQUIRED", error: "Please log in and connect Gmail." }, { status: 401 });
    }

    const filename = `${user.id}/${randomUUID()}.pdf`;
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
  } catch (error) {
    return authError(error, "Could not create an upload URL. Check the certificates bucket configuration.");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ code: "LOGIN_REQUIRED", error: "Please log in." }, { status: 401 });
    const { path } = await req.json();
    if (typeof path !== "string" || !path.startsWith(user.id + "/") || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(path)) {
      return NextResponse.json({ error: "Invalid certificate path." }, { status: 400 });
    }
    const { error } = await supabase.storage.from("certificates").remove([path]);
    if (error) throw new Error("Temporary upload cleanup failed.");
    return NextResponse.json({ ok: true });
  } catch (error) { return authError(error, "Could not remove temporary upload."); }
}
