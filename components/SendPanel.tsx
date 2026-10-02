"use client";
import { useState } from "react";
import { GeneratedCert, Recipient } from "@/types";
import ProgressBar from "./ProgressBar";

async function fetchWithTimeout(resource: string, options: RequestInit = {}, timeoutMs = 60000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

export default function SendPanel({ certs, recipients }: { certs: GeneratedCert[]; recipients: Recipient[] }) {
  const [fromName, setFromName] = useState("");
  const [subject, setSubject] = useState("Your Certificate 🎉");
  const [body, setBody] = useState("Hi {name}, please find your certificate attached.");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<{ to: string; ok: boolean; error?: string }[]>([]);

  const recMap = new Map(recipients.map((r) => [r.id, r]));

  async function handleSend() {
    setSending(true);
    setDone(0);
    setResults([]);

    const newResults: { to: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < certs.length; i++) {
      const cert = certs[i];
      const recipient = recMap.get(cert.recipientId);
      if (!recipient) continue;

      const recipientEmail = recipient.email;
      const pdfSizeMB = (cert.pdfBlob.size / (1024 * 1024)).toFixed(2);
      console.log(`[SEND_PAYLOAD_LOG] Recipient: ${recipientEmail} | Certificate PDF Size: ${pdfSizeMB} MB | Sending via direct Supabase upload...`);

      try {
        // Step 1: Request signed upload URL from serverless endpoint
        const uploadUrlRes = await fetchWithTimeout("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }, 60000);

        if (!uploadUrlRes.ok) {
          const errText = await uploadUrlRes.text();
          let errMessage = errText;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) errMessage = parsed.error;
          } catch {}
          console.error(`[SEND_ERROR] Upload URL failed for ${recipientEmail}:`, errMessage);
          newResults.push({ to: recipientEmail, ok: false, error: `Upload URL error: ${errMessage}` });
          setResults([...newResults]);
          setDone(i + 1);
          continue;
        }

        const { path, signedUrl, token } = await uploadUrlRes.json();

        // Step 2: Upload full-quality PDF blob directly to Supabase storage signed URL (bypassing Vercel body size limit)
        const uploadRes = await fetchWithTimeout(signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "application/pdf",
            ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          },
          body: cert.pdfBlob,
        }, 60000);

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          let errMessage = errText;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) errMessage = parsed.error;
          } catch {}
          console.error(`[SEND_ERROR] Direct storage upload failed for ${recipientEmail}:`, errMessage);
          newResults.push({ to: recipientEmail, ok: false, error: `Storage upload error: ${errMessage}` });
          setResults([...newResults]);
          setDone(i + 1);
          continue;
        }

        // Step 3: Trigger email dispatch with small JSON payload
        const formattedBody = body.replace(/{name}/g, recipient.name);
        const attachmentName = `certificate_${recipient.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

        const sendRes = await fetchWithTimeout("/api/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path,
            to: recipientEmail,
            name: recipient.name,
            subject,
            message: formattedBody,
            bodyHtml: `<p>${formattedBody.replace(/\n/g, "<br/>")}</p>`,
            fromName: fromName.trim() || undefined,
            attachmentName,
          }),
        }, 60000);

        if (!sendRes.ok) {
          const errText = await sendRes.text();
          let errMessage = errText;
          try {
            const parsed = JSON.parse(errText);
            if (parsed.error) errMessage = parsed.error;
          } catch {}
          console.error(`[SEND_ERROR] Send route failed for ${recipientEmail}:`, errMessage);
          newResults.push({ to: recipientEmail, ok: false, error: errMessage });
        } else {
          newResults.push({ to: recipientEmail, ok: true });
        }
      } catch (err: any) {
        console.error(`[SEND_EXCEPTION] Unexpected error for ${recipientEmail}:`, err?.message || err);
        newResults.push({ to: recipientEmail, ok: false, error: err?.message || "Sending failed" });
      }

      setResults([...newResults]);
      setDone(i + 1);
    }

    setSending(false);
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

      <div className="pt-2">
        <button
          onClick={handleSend}
          disabled={sending || certs.length === 0}
          className="w-full sm:w-auto bg-[#F9654B] hover:bg-[#E04F34] text-white font-medium text-sm px-6 py-3 min-h-[44px] rounded-xl disabled:opacity-40 transition-all shadow-xs cursor-pointer flex items-center justify-center"
        >
          {sending ? `Sending emails... ${done}/${certs.length} done` : `Send ${certs.length} certificates`}
        </button>
      </div>

      {sending && <ProgressBar done={done} total={certs.length} />}
      
      {results.length > 0 && (
        <ul className="text-xs space-y-1.5 mt-4 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-200">
          {results.map((r, i) => (
            <li key={i} className={`flex items-center gap-2 ${r.ok ? "text-emerald-700 font-medium" : "text-rose-600 font-medium"}`}>
              <span>{r.ok ? "✓" : "✕"}</span>
              <span className="truncate">{r.to} — {r.ok ? "sent successfully" : r.error}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}



