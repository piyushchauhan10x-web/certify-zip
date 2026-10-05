import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { supabase } from "./db";

function sessionSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be configured.");
  return secret;
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
  try {
    const payload = jwt.verify(token, sessionSecret(), { algorithms: ["HS256"] }) as { userId?: string; purpose?: string };
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
  try {
    const payload = jwt.verify(token, sessionSecret(), { algorithms: ["HS256"] }) as { userId: string; purpose: string };
    if (payload.purpose !== "reset") return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const cookieStore = cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, google_access_token, google_refresh_token, google_email, google_token_expiry, google_granted_scopes")
    .eq("id", payload.userId)
    .single();

  if (error || !data) return null;
  return data;
}
