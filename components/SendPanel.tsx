"use client";
import { useState } from "react";
import { GeneratedCert, Recipient } from "@/types";
import ProgressBar from "./ProgressBar";
import ConnectGmail from "./ConnectGmail";
import { request, HttpError } from "@/lib/http";
type Result = { id: string; to: string; ok: boolean; error?: string };
export default function SendPanel({ certs, recipients }: { certs: GeneratedCert[]; recipients: Recipient[] }) {
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("Your Certificate 🎉");
  const [body, setBody] = useState("Hi {name}, please find your certificate attached.");
  const [sending, setSending] = useState(false);
  const [reconnect, setReconnect] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const recMap = new Map(recipients.map(r => [r.id, r]));
  const currentResults = results.filter(r => certs.some(c => c.recipientId === r.id));
  const pending = certs.filter(c => !currentResults.some(r => r.id === c.recipientId && r.ok));
  async function handleSend() {
    if (sending) return;
    setSending(true); setReconnect(false); setDone(0);
    const next = [...currentResults.filter(r => r.ok)];
    try {
      // Concurrency is deliberately one: await upload and delivery for each recipient.
      for (const cert of pending) {
        const recipient = recMap.get(cert.recipientId);
        if (!recipient) continue;
        let delivering = false;
        let uploadPath = "";
        try {
          const { path, signedUrl } = await request<{ path: string; signedUrl: string }>("/api/upload-url", { method: "POST" });
          uploadPath = path;
          await request(signedUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: cert.pdfBlob }, 60000, false);
          delivering = true;
          await request("/api/send", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, to: recipient.email, name: recipient.name, subject, message: body.replaceAll("{name}", recipient.name), fromName }),
          }, 150000);
          next.push({ id: recipient.id, to: recipient.email, ok: true });
        } catch (error) {
          console.error("[CERTIFICATE_SEND] Upload or delivery failed.");
          if (error instanceof HttpError && ["LOGIN_REQUIRED", "RECONNECT_GMAIL", "GMAIL_PERMISSION_MISSING"].includes(error.code || "")) setReconnect(true);
          const message = error instanceof Error ? error.message : "Certificate delivery failed.";
          next.push({ id: recipient.id, to: recipient.email, ok: false, error: delivering && (!(error instanceof HttpError) || error.status === 408) ? message + " Check Sent mail before retrying; delivery may have completed." : message });
        } finally {
          if (uploadPath && !delivering) {
            try { await request("/api/upload-url", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path: uploadPath }) }); }
            catch { console.error("[UPLOAD_CLEANUP] Could not remove temporary upload."); }
          }
        }
        setResults([...next]); setDone(n => n + 1);
      }
    } finally { setSending(false); }
  }
  return (
    <div className="space-y-4 text-gray-900 min-w-0 max-w-full">
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">From name (optional)</label>
        <input
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="e.g. Certify Events Team"
          className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-base sm:text-sm min-h-[44px] focus:outline-none focus:border-[#F9654B] transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Subject Line</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-base sm:text-sm min-h-[44px] focus:outline-none focus:border-[#F9654B] transition-colors"
          placeholder="Subject"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Message Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-base sm:text-sm focus:outline-none focus:border-[#F9654B] transition-colors"
          rows={3}
          placeholder="Body ({name} placeholder supported)"
        />
      </div>

      <div className="pt-2 sticky bottom-0 bg-white pb-[max(12px,env(safe-area-inset-bottom))] z-10">
        <button
          onClick={handleSend}
          disabled={sending || pending.length === 0 || !subject.trim()}
          className="w-full sm:w-auto bg-[#F9654B] hover:bg-[#E04F34] text-white font-medium text-sm px-6 py-3 min-h-[44px] rounded-xl disabled:opacity-40 transition-all shadow-xs cursor-pointer flex items-center justify-center"
        >
          {sending ? `Sending emails... ${done} done` : pending.length === 0 ? "All certificates sent" : currentResults.length ? `Retry / send ${pending.length} remaining` : `Send ${pending.length} certificates`}
        </button>
      </div>

      {reconnect && (
        <ConnectGmail className="text-sm font-semibold text-[#F9654B] underline">Reconnect Gmail</ConnectGmail>
      )}
      {sending && <ProgressBar done={done} total={certs.length} />}
      
      {!sending && currentResults.length > 0 && <p role="status" className="text-sm">{currentResults.filter(r => r.ok).length} sent, {currentResults.filter(r => !r.ok).length} failed. Retry sends only remaining certificates.</p>}
      {currentResults.length > 0 && (
        <ul className="text-xs space-y-1.5 mt-4 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-200">
          {currentResults.map((r, i) => (
            <li key={i} className={`flex items-center gap-2 ${r.ok ? "text-emerald-700 font-medium" : "text-rose-600 font-medium"}`}>
              <span>{r.ok ? "✓" : "✕"}</span>
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">{r.to} — {r.ok ? "sent successfully" : r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}



