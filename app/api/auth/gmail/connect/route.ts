import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { startOAuth } from "@/lib/oauthFlow";
import { authError } from "@/lib/authErrors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Please log in before connecting Gmail." }, { status: 401 });
    return startOAuth(req, user.id);
  } catch (error) { return authError(error, "Gmail connection could not be started."); }
}
