import { z } from "zod";

export const authSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(6).max(100).refine(value => Buffer.byteLength(value, "utf8") <= 72, "Password must be at most 72 bytes"),
});

// ILIKE treats '%' and '_' as wildcards, even inside valid email addresses.
export function emailLookupPattern(email: string) {
  return email.replace(/[\\%_]/g, character => `\\${character}`);
}

export const sheetImportSchema = z.object({
  sheetUrl: z.string().url().max(500),
});

export const sendItemSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  bodyHtml: z.string().max(5000),
  attachmentBase64: z.string(),
  attachmentName: z.string().max(200),
});

export const sendRequestSchema = z.object({
  items: z.array(sendItemSchema).max(500),
  fromName: z.string().max(100).optional(),
});
