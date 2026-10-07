"use client";
import { createClient } from "@/lib/supabase/client";
import { withAuthTimeout, authMessage, authException } from "@/lib/authUi";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
    const { error } = await withAuthTimeout((await createClient()).auth.updateUser({ password }));
    if (error) { setError(authMessage(error)); return; }
    const { error: logoutError } = await withAuthTimeout((await createClient()).auth.signOut({ scope: "local" }));
    if (logoutError) { setError("Your password was changed, but sign-out failed. Return to login and sign out before switching accounts."); return; }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
    } catch (error) { console.error("[PASSWORD_UPDATE] Request failed."); setError(authException(error)); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <h1 className="font-display font-semibold text-xl mb-1">Set new password</h1>
        <p className="text-sm text-muted mb-6">Choose a new password for your account.</p>
        {done ? (
          <p className="text-sm text-accent2">Password reset. Redirecting to login...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 text-white font-medium text-sm py-2.5 rounded-lg disabled:opacity-40 transition-all"
            >
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
