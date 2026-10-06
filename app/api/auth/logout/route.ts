import { NextRequest, NextResponse } from 'next/server';
import { authCookieOptions } from '@/lib/oauth';
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', '', { ...authCookieOptions(req), maxAge: 0 });
  return res;
}
