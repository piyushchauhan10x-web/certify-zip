"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode: initialMode }: { mode: "login" | "register" }) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  function switchMode(target: "login" | "register") {
    if (target === mode) return;
    setError("");
    setMode(target);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(mode === "register" && { name }) }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected network error occurred.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-gray-900 font-sans flex items-center justify-center relative overflow-hidden select-none p-4 sm:p-6">
      {/* Decorative Certificate & Document Watermark Line-Art Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-50"
        style={{
          backgroundImage: `url('/cert_bg_pattern.svg')`,
          backgroundRepeat: 'repeat',
          backgroundSize: '360px 360px',
          backgroundPosition: 'center top',
        }}
      />

      {/* Subtle Ambient Radial Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-[#FFF0ED]/40 via-blue-50/30 to-transparent blur-3xl pointer-events-none z-0" />

      {/* Centered Floating Auth Card */}
      <div className="relative z-10 w-full max-w-[440px] bg-white border border-gray-200 rounded-2xl p-5 sm:p-9 shadow-xs transition-all duration-300 min-w-0">
        
        {/* App Branding Header (Matches Main Application Header) */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-[#F9654B] flex items-center justify-center text-white shrink-0 shadow-xs">
            <svg className="w-4 h-4 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">Certify</span>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 text-center tracking-tight mt-3 mb-1.5">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 text-center mb-6">
          {mode === "login"
            ? "Sign in to continue to your certificate workspace"
            : "Get started with Certify"}
        </p>

        {/* Google OAuth Option */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 transition-all text-xs sm:text-sm font-medium text-gray-700 shadow-xs mb-5 group min-h-[44px]"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z" />
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z" />
          </svg>
          <span>Continue with Google</span>
        </a>

        {/* Divider */}
        <div className="relative flex items-center justify-center mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <span className="relative px-3 text-[11px] uppercase tracking-wider text-gray-400 bg-white font-medium">
            or with email
          </span>
        </div>

        {/* Form Controls */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Full Name</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-gray-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-base sm:text-sm min-h-[44px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F9654B] focus:ring-1 focus:ring-[#F9654B] transition-all"
                />
              </div>
            </div>
          )}

          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Email</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-gray-400 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 002-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-base sm:text-sm min-h-[44px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F9654B] focus:ring-1 focus:ring-[#F9654B] transition-all"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Password</label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-gray-400 pointer-events-none">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
                className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-10 text-base sm:text-sm min-h-[44px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F9654B] focus:ring-1 focus:ring-[#F9654B] transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 text-gray-400 hover:text-gray-600 transition-colors p-2 min-h-[44px] flex items-center justify-center"
                aria-label="Toggle password visibility"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 013.982-.863c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-6.168-6.168a3 3 0 00-4.243-4.243m4.242 4.242L3 3m18 18l-3.228-3.228" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-gray-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                  className="w-full bg-white border border-gray-300 rounded-xl py-2.5 pl-10 pr-4 text-base sm:text-sm min-h-[44px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F9654B] focus:ring-1 focus:ring-[#F9654B] transition-all"
                />
              </div>
            </div>
          )}

          {/* Remember Me & Forgot Password Row */}
          {mode === "login" && (
            <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5 pb-0.5 min-h-[44px]">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-800 transition-colors select-none py-1">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#F9654B] focus:ring-[#F9654B] accent-[#F9654B] cursor-pointer"
                />
                <span className="text-xs text-gray-600">Remember me</span>
              </label>
              <a
                href="/forgot-password"
                className="text-xs text-[#F9654B] hover:underline font-medium py-1"
              >
                Forgot password?
              </a>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <p className="text-xs text-rose-600 font-medium">{error}</p>
          )}

          {/* Submit Button (Matches "Continue to design ->" accent button) */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#F9654B] hover:bg-[#E04F34] text-white text-xs sm:text-sm font-medium py-3 min-h-[44px] shadow-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <span>{loading ? "Verifying..." : mode === "login" ? "Sign In" : "Create account"}</span>
            {!loading && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </form>

        {/* Footer Mode Switcher Link */}
        <div className="mt-6 text-center">
          {mode === "login" ? (
            <p className="text-xs sm:text-sm text-gray-500">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="text-[#F9654B] hover:underline font-semibold ml-1"
              >
                Create an account
              </button>
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="text-[#F9654B] hover:underline font-semibold ml-1"
              >
                Sign in
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
