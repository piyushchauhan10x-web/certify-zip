import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { supabase } from "./db";
import { requireEnv } from "./authErrors";
import type { GmailUser } from "./gmail";
type SessionUser = GmailUser & { email: string };

function sessionSecret(): string {
  requireEnv("JWT_SECRET");
  return process.env.JWT_SECRET!.trim();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ userId }, sessionSecret(), { expiresIn: "30d" });
}

export function verifySessionToken(token: string): { userId: string } | null {
  const secret = sessionSecret();
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as { userId?: string; purpose?: string };
    if (typeof payload.userId !== "string" || payload.purpose) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function createResetToken(userId: string): string {
  return jwt.sign({ userId, purpose: "reset" }, sessionSecret(), { expiresIn: "30m" });
}

export function verifyResetToken(token: string): { userId: string } | null {
  const secret = sessionSecret();
  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as { userId: string; purpose: string };
    if (payload.purpose !== "reset" || typeof payload.userId !== "string") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function getCurrentUser(withGmail = false): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const { data, error } = await supabase
    .from("users")
    .select(withGmail ? "*" : "id, email")
    .eq("id", payload.userId)
    .returns<SessionUser[]>()
    .maybeSingle();

  if (error) throw new Error("User lookup failed.");
  if (!data) return null;
  return { ...data, google_access_token: data.google_access_token ?? null, google_refresh_token: data.google_refresh_token ?? null, google_email: data.google_email ?? null, google_token_expiry: data.google_token_expiry ?? null, google_granted_scopes: data.google_granted_scopes ?? null };
}
