"use client";
import { useEffect, useState } from "react";
import { request } from "@/lib/http";

export async function checkSendingAccount() {
  const status = await request<{ googleConnected: boolean; googleEmail: string | null; connectionError?: string }>("/api/auth/me", { cache: "no-store" });
  if (status.connectionError) throw new Error(status.connectionError);
  return status;
}

export default function SendGmailConnection({ onReady }: { onReady: () => void }) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    let active = true;
    checkSendingAccount().then(status => {
      if (active && status.googleConnected) onReady();
    }).catch(() => {
      console.error("[SEND_GMAIL_STATUS] Could not check sending account.");
      if (active) setError("Could not check your Gmail connection. Please try Continue again.");
    }).finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [onReady]);

  async function proceed() {
    setChecking(true); setError("");
    try {
      const status = await checkSendingAccount();
      if (status.googleConnected) onReady();
      else setError("Gmail is not connected yet. Select your account and allow sending permission, then return here to continue.");
    } catch {
      console.error("[SEND_GMAIL_CONTINUE] Could not verify connection.");
      setError("Could not verify your Gmail connection. Please try again.");
    } finally { setChecking(false); }
  }

  return <section aria-labelledby="send-gmail-title" className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
    <h3 id="send-gmail-title" className="font-semibold text-gray-900">Connect Gmail to send certificates</h3>
    <p className="text-sm text-gray-600">Choose the Gmail account you want to send from and allow Certify to send emails. Your Certify login stays the same.</p>
    <p className="text-sm text-gray-600">Google opens in a separate tab so your certificates and message stay here. After connecting, return here and select Continue. No emails are sent until you press Send.</p>
    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="button" disabled={checking} onClick={() => {
        setError("");
        const tab = window.open("/api/auth/gmail/connect", "_blank");
        if (tab) { tab.opener = null; setOpened(true); }
        else setError("Your browser blocked the connection tab. Allow pop-ups for Certify and try again.");
      }} className="min-h-[44px] rounded-xl bg-[#17634D] px-5 py-3 text-sm font-medium text-white hover:bg-[#104D3B] disabled:opacity-40">Select Gmail account</button>
      <button type="button" disabled={checking} onClick={proceed} className="min-h-[44px] rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-40">{checking ? "Checking connection…" : "Continue"}</button>
    </div>
    {opened && !error && <p role="status" className="text-sm text-gray-600">Finish connecting in the Google tab, then return here.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
