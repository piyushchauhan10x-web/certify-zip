"use client";
import { useState } from "react";
import { request } from "@/lib/http";
import { Recipient } from "@/types";

export default function GoogleSheetImport({ onImported }: { onImported: (r: Recipient[]) => void }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await request<{ recipients: Recipient[] }>("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl: url }),
      });

      onImported(data.recipients);
    } catch (err: any) {
      console.error("[SHEETS_IMPORT] Could not import sheet.");
      setError("Failed to import: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full min-h-[180px] bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 sm:p-6 flex flex-col justify-center gap-3 min-w-0 max-w-full">
      <div className="flex flex-col sm:flex-row gap-2.5 w-full">
        <input
          type="url"
          placeholder="Paste Google Sheets link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 bg-white border border-gray-300 text-gray-900 rounded-xl px-3.5 py-2.5 text-base sm:text-sm min-h-[44px] focus:outline-none focus:border-[#F9654B] focus:ring-1 focus:ring-[#F9654B] placeholder:text-gray-400 w-full"
        />
        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="bg-[#F9654B] hover:bg-[#E04F34] text-white text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-xl disabled:opacity-40 transition-colors shadow-xs w-full sm:w-auto cursor-pointer flex items-center justify-center shrink-0"
        >
          {loading ? "Importing..." : "Import"}
        </button>
      </div>
      <p className="text-xs text-gray-500">Sheet must be shared with your connected Google account, or set to &quot;Anyone with the link&quot;</p>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

