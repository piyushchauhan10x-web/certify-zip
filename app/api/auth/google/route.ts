import { NextRequest } from "next/server";
import { startOAuth } from "@/lib/oauthFlow";
import { authError } from "@/lib/authErrors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try { return startOAuth(req, "google"); }
  catch (error) { return authError(error, "Google login could not be started."); }
}
