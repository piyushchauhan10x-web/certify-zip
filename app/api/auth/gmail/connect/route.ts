import { NextRequest } from "next/server";
import { startGoogleConnection } from "@/lib/oauthStart";
export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  return startGoogleConnection(req);
}
