export function publicAuthConfig() {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const values = names.map(name => (process.env[name] || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim());
  const missing = names.filter((_, i) => !values[i]);
  if (missing.length) throw new Error(`Missing env: ${missing.join(", ")}`);
  try {
    const url = new URL(values[0]);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error();
  } catch { throw new Error("Invalid configuration: NEXT_PUBLIC_SUPABASE_URL must be an HTTPS URL."); }
  // Refuse privileged keys in the public configuration endpoint.
  if (!values[1].startsWith("sb_publishable_")) {
    let role = "";
    try { role = JSON.parse(atob(values[1].split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; }
    catch { console.error("[AUTH_CONFIG] Invalid public Supabase key format."); }
    if (role !== "anon") throw new Error("Invalid configuration: NEXT_PUBLIC_SUPABASE_ANON_KEY must be the public anon or publishable key, never a service key.");
  }
  return { url: values[0], key: values[1] };
}
