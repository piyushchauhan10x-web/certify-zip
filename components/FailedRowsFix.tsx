"use client";
import { useState } from "react";
import { Recipient } from "@/types";

interface Props {
  recipients: Recipient[];
  onUpdate: (updated: Recipient[]) => void;
}

export default function FailedRowsFix({ recipients, onUpdate }: Props) {
  const [edits, setEdits] = useState<Record<string, { name: string; email: string }>>({});
  const failed = recipients.filter((r) => r.status === "failed");

  if (failed.length === 0) return null;

  function updateField(id: string, field: "name" | "email", value: string) {
    setEdits((prev) => ({
      ...prev,
      [id]: {
        name: field === "name" ? value : prev[id]?.name ?? recipients.find((r) => r.id === id)!.name,
        email: field === "email" ? value : prev[id]?.email ?? recipients.find((r) => r.id === id)!.email,
      },
    }));
  }

  function applyFix(id: string) {
    const edit = edits[id];
    if (!edit) return;
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const valid = edit.name.trim() && emailRe.test(edit.email);

    const updated = recipients.map((r) =>
      r.id === id
        ? { ...r, name: edit.name.trim(), email: edit.email.trim().toLowerCase(), status: valid ? ("pending" as const) : ("failed" as const), error: valid ? undefined : "Still invalid" }
        : r
    );
    onUpdate(updated);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-rose-400">{failed.length} rows need fixing before they can be sent:</p>
      {failed.map((r) => {
        const edit = edits[r.id] || { name: r.name, email: r.email };
        return (
          <div key={r.id} className="flex items-center gap-2 bg-[#09090B] border border-rose-500/30 rounded-xl p-3">
            <input
              value={edit.name}
              onChange={(e) => updateField(r.id, "name", e.target.value)}
              placeholder="Name"
              className="flex-1 bg-[#18181B] border border-[#27272A] text-white placeholder-gray-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#F9654B]"
            />
            <input
              value={edit.email}
              onChange={(e) => updateField(r.id, "email", e.target.value)}
              placeholder="Email"
              className="flex-1 bg-[#18181B] border border-[#27272A] text-white placeholder-gray-400 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#F9654B]"
            />
            <span className="text-xs text-rose-400 whitespace-nowrap">{r.error}</span>
            <button
              onClick={() => applyFix(r.id)}
              className="text-xs bg-[#F9654B] hover:bg-[#E04F34] text-white font-medium px-3.5 py-1.5 rounded-lg transition-colors"
            >
              Fix
            </button>
          </div>
        );
      })}
    </div>
  );
}

