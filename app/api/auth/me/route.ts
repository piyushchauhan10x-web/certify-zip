import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { gmailConnected, getGmailConnection } from '@/lib/gmail';
import { authError } from '@/lib/authErrors';
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ loggedIn: false, error: "Please log in." }, { status: 401 });
  }
  let connection = null;
  let connectionError: string | undefined;
  try { connection = await getGmailConnection(user.id); }
  catch { console.error("[GMAIL_STATUS] Could not load Gmail connection."); connectionError = "Your session is valid, but Gmail status is unavailable. Check SUPABASE_SERVICE_KEY and the gmail_tokens table."; }
  return NextResponse.json({
    loggedIn: true,
    connectionError,
    email: user.email,
    googleConnected: connection ? gmailConnected(connection) : false,
    googleEmail: connection?.google_email || null,
  });
  } catch (error) { return authError(error, "Could not check your session. Please try again."); }
}
