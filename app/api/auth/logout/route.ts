import { NextResponse } from 'next/server';
import { authCookieOptions } from '@/lib/oauth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set('session', '', { ...authCookieOptions(), maxAge: 0 });
  return res;
}