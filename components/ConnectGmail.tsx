"use client";
import { useState } from "react";
import { request } from "@/lib/http";
export default function ConnectGmail({ className, children = "Connect Gmail", purpose }: { className?: string; children?: React.ReactNode; purpose?: "sheets" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const { url } = await request<{ url: string }>("/api/auth/gmail/connect?format=json" + (purpose === "sheets" ? "&purpose=sheets" : ""));
      window.location.assign(url);
    } catch (error) { console.error("[GMAIL_CONNECT] Connection could not be started."); setError(error instanceof Error ? error.message : "Gmail connection failed."); }
    finally { setLoading(false); }
  }
  return <span className="min-w-0"><button type="button" disabled={loading} onClick={connect} className={className}>{loading ? "Connecting…" : children}</button>{error && <span role="alert" className="block text-sm text-red-600 break-words">{error}</span>}</span>;
}
