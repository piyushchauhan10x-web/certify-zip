import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { supabase } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "319f5e9d2d7212626dce9974e8280e2305fc53e821dd51b1357d6a917904aada";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifySessionToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export function createResetToken(userId: string): string {
  return jwt.sign({ userId, purpose: "reset" }, JWT_SECRET, { expiresIn: "30m" });
}

export function verifyResetToken(token: string): { userId: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string };
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
    .select("id, email, google_access_token, google_refresh_token, google_email")
    .eq("id", payload.userId)
    .single();

  if (error || !data) return null;
  return data;
}
