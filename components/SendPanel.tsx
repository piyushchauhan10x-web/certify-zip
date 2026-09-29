"use client";
import { useState } from "react";
import { GeneratedCert, Recipient } from "@/types";
import ProgressBar from "./ProgressBar";

export default function SendPanel({ certs, recipients }: { certs: GeneratedCert[]; recipients: Recipient[] }) {
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("Your Certificate 🎉");
  const [body, setBody] = useState("Hi {name}, please find your certificate attached.");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<{ to: string; ok: boolean; error?: string }[]>([]);

  const recMap = new Map(recipients.map((r) => [r.id, r]));

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function handleSend() {
    setSending(true);
    setDone(0);
    const items = [];
    for (const cert of certs) {
      const recipient = recMap.get(cert.recipientId);
      if (!recipient) continue;
      items.push({
        to: recipient.email,
        subject,
        bodyHtml: body.replace("{name}", recipient.name),
        attachmentBase64: await blobToBase64(cert.pdfBlob),
        attachmentName: `certificate_${recipient.name}.pdf`,
      });
    }
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, fromName: fromName.trim() || undefined }),
    });
    const data = await res.json();
    setResults(data.results || []);
    setDone(items.length);
    setSending(false);
  }

  return (
    <div className="space-y-4 text-gray-900">
      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">From name (optional)</label>
        <input
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          placeholder="e.g. Certify Events Team"
          className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F9654B] transition-colors"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Subject Line</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F9654B] transition-colors"
          placeholder="Subject"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Message Body</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F9654B] transition-colors"
          rows={3}
          placeholder="Body ({name} placeholder supported)"
        />
      </div>

      <div className="pt-2">
        <button
          onClick={handleSend}
          disabled={sending || certs.length === 0}
          className="bg-[#F9654B] hover:bg-[#E04F34] text-white font-medium text-sm px-6 py-3 rounded-xl disabled:opacity-40 transition-all shadow-xs"
        >
          {sending ? "Sending emails..." : `Send ${certs.length} certificates`}
        </button>
      </div>

      {sending && <ProgressBar done={done} total={certs.length} />}
      
      {results.length > 0 && (
        <ul className="text-xs space-y-1.5 mt-4 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-200">
          {results.map((r, i) => (
            <li key={i} className={`flex items-center gap-2 ${r.ok ? "text-emerald-700 font-medium" : "text-rose-600 font-medium"}`}>
              <span>{r.ok ? "✓" : "✕"}</span>
              <span>{r.to} — {r.ok ? "sent successfully" : r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


