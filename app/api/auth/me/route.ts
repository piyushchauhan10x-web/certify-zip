import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gmailConnected, getGmailConnection } from '@/lib/gmail';
import { authError } from '@/lib/authErrors';
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false, error: "Please log in." }, { status: 401 });
  }
  const connection = await getGmailConnection(user.id);
  return NextResponse.json({
    loggedIn: true,
    email: user.email,
    googleConnected: connection ? gmailConnected(connection) : false,
    googleEmail: connection?.google_email || null,
  });
  } catch (error) { return authError(error, "Could not check your session. Please try again."); }
}
