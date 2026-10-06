import "server-only";
import { createClient } from "./supabase/server";
export async function getCurrentUser() {
  const { data: { user }, error } = await createClient().auth.getUser();
  if (error && error.status && error.status >= 500) throw new Error("Authentication service unavailable.");
  return user;
}
