import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/oauth";

export async function GET() {
  const user = await getCurrentUser();
  const state = user ? user.id : "signin";
  return NextResponse.redirect(buildAuthUrl(state));
}
