import { google } from "googleapis";
import { GOOGLE_OAUTH_CONFIG } from "./oauth";
import { Recipient } from "@/types";
import { nanoid } from "nanoid";

export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function fetchSheetData(
  accessToken: string,
  refreshToken: string,
  sheetId: string
): Promise<Recipient[]> {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );
  oauth2Client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "A1:Z1000",
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h) => String(h).toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes("name"));
  const emailIdx = headers.findIndex((h) => h.includes("email") || h.includes("mail"));
  const catIdx = headers.findIndex((h) => h.includes("category") || h.includes("type"));

  const dataRows = rows.slice(1);

  return dataRows.map((row) => ({
    id: nanoid(8),
    name: String(row[nameIdx] ?? "").trim(),
    email: String(row[emailIdx] ?? "").trim().toLowerCase(),
    category: catIdx >= 0 ? String(row[catIdx] ?? "").trim() : undefined,
    extra: {},
    status: "pending" as const,
  }));
}

