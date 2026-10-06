import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractSheetId, fetchSheetData } from "@/lib/googleSheets";
import { validateRecipients } from "@/lib/parseExcel";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import { sheetImportSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const clientKey = getClientKey(req);
  if (!checkRateLimit(`sheets:${clientKey}`, 15, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  }

  try {
    const user = await getCurrentUser(true);
    if (!user || !user.google_access_token || !user.google_refresh_token) {
      return NextResponse.json({ error: "Connect Gmail first to access Google Sheets" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = sheetImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sheet URL" }, { status: 400 });
    }

    const sheetId = extractSheetId(parsed.data.sheetUrl);
    if (!sheetId) {
      return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 });
    }

    const recipients = await fetchSheetData(user.google_access_token, user.google_refresh_token, sheetId);
    if (recipients.length === 0) {
      return NextResponse.json({ error: "No data found, or sheet not shared with your account" }, { status: 400 });
    }
    return NextResponse.json({ recipients: validateRecipients(recipients) });
  } catch (err: any) {
    console.error("[SHEETS_ERROR] Failed to fetch sheet.");
    return NextResponse.json({ error: "Failed to fetch sheet" }, { status: 500 });
  }
}
