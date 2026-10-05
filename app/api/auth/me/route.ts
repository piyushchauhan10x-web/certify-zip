import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gmailConnected } from '@/lib/gmail';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false });
  }
  return NextResponse.json({
    loggedIn: true,
    email: user.email,
    googleConnected: gmailConnected(user),
    googleEmail: user.google_email,
  });
}