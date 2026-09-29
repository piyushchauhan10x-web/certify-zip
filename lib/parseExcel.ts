import * as XLSX from "xlsx";
import { nanoid } from "nanoid";
import { Recipient } from "@/types";

export function parseExcelFile(file: File): Promise<Recipient[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows.map(mapRowToRecipient));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function mapRowToRecipient(row: Record<string, any>): Recipient {
  const keys = Object.keys(row);
  const nameKey = keys.find((k) => /name/i.test(k)) || keys[0];
  const emailKey = keys.find((k) => /email|e-mail|mail/i.test(k)) || keys[1];
  const catKey = keys.find((k) => /category|type/i.test(k));

  const extra: Record<string, string> = {};
  keys.forEach((k) => {
    if (k !== nameKey && k !== emailKey && k !== catKey) {
      extra[k] = String(row[k] ?? "").trim();
    }
  });

  return {
    id: nanoid(8),
    name: String(row[nameKey] ?? "").trim(),
    email: String(row[emailKey] ?? "").trim().toLowerCase(),
    category: catKey ? String(row[catKey]).trim() : "default",
    extra,
    status: "pending",
  };
}

export function validateRecipients(recipients: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return recipients.map((r) => {
    if (!r.name) return { ...r, status: "failed", error: "Empty name" };
    if (!emailRe.test(r.email)) return { ...r, status: "failed", error: "Invalid email" };
    if (seen.has(r.email)) return { ...r, status: "failed", error: "Duplicate email" };
    seen.add(r.email);
    return { ...r, status: "pending", error: undefined };
  });
}

export function getAvailableFieldKeys(recipients: Recipient[]): { key: string; label: string }[] {
  const fields: { key: string; label: string }[] = [
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
  ];
  const extraKeys = new Set<string>();
  recipients.forEach((r) => Object.keys(r.extra).forEach((k) => extraKeys.add(k)));
  extraKeys.forEach((k) => fields.push({ key: k, label: k }));
  return fields;
}

export function getCategories(recipients: Recipient[]): string[] {
  const cats = new Set<string>();
  recipients.forEach((r) => cats.add(r.category || "default"));
  return Array.from(cats);
}
