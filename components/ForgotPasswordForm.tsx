"use client";
import { useState } from "react";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setLoading(false);
    setMessage(data.message || data.error || "Something happened");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <h1 className="font-display font-semibold text-xl mb-1">Reset password</h1>
        <p className="text-sm text-muted mb-6">We&apos;ll email you a reset link.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-bg border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/90 text-white font-medium text-sm py-2.5 rounded-lg disabled:opacity-40 transition-all"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        {message && <p className="text-sm text-muted mt-4">{message}</p>}
        <a href="/login" className="text-sm text-accent hover:underline block text-center mt-6">Back to login</a>
      </div>
    </div>
  );
}
