"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import UploadExcel from "@/components/UploadExcel";
import GoogleSheetImport from "@/components/GoogleSheetImport";
import TemplateManager from "@/components/TemplateManager";
import FailedRowsFix from "@/components/FailedRowsFix";
import PreviewGrid from "@/components/PreviewGrid";
import SendPanel from "@/components/SendPanel";
import ProgressBar from "@/components/ProgressBar";
import { generateAll } from "@/lib/generateCert";
import { getAvailableFieldKeys, getCategories } from "@/lib/parseExcel";
import { Recipient, TemplateConfig, GeneratedCert } from "@/types";

const STEPS = [
  { num: 1, label: "Add data" },
  { num: 2, label: "Design" },
  { num: 3, label: "Generate" },
  { num: 4, label: "Review" },
  { num: 5, label: "Send" },
];

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "sheet">("file");
  const [gmailDenied, setGmailDenied] = useState(false);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [certs, setCerts] = useState<GeneratedCert[]>([]);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [generating, setGenerating] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (["denied", "reconnect"].includes(params.get("gmail") || "")) {
        setGmailDenied(true);
      }
    }

    fetch("/api/auth/me", { signal: AbortSignal.timeout(30000) })
      .then(async (r) => {
        const data = await r.json();
        if (r.status === 401) { router.push("/login"); return { loggedIn: false }; }
        if (!r.ok) throw new Error(data.error || "Could not check your session.");
        return data;
      })
      .then((data) => {
        if (!data.loggedIn) {
          if (new URLSearchParams(window.location.search).get("gmail") === "denied") return;
          router.push("/login");
          return;
        }
        setGoogleConnected(data.googleConnected);
        setGoogleEmail(data.googleEmail || "");
        setUserEmail(data.email || "");
        setAuthChecked(true);
      }).catch(() => router.push("/login?error=session_check"));
  }, [router]);

  async function handleLogout() {
    const { error } = await createClient().auth.signOut();
    if (error) { window.alert("Could not sign out. Please try again."); return; }
    router.push("/login");
  }

  async function handleGenerate() {
    if (templates.length === 0) return;
    setGenerating(true);
    setGenProgress({ done: 0, total: recipients.length });
    const results = await generateAll(recipients, templates, (done, total) => setGenProgress({ done, total }));
    setCerts(results);
    setGenerating(false);
  }

  if (!authChecked) return gmailDenied ? (
    <div className="max-w-xl mx-auto p-6 text-amber-900">
      <p>Tick the Gmail permission box on the Google screen</p>
      <a href="/api/auth/gmail/connect" className="text-sm font-semibold text-[#F9654B] underline">Reconnect Gmail</a>
    </div>
  ) : null;

  const validCount = recipients.filter((r) => r.status !== "failed").length;
  const failedCount = recipients.length - validCount;
  const computedStep = certs.length > 0 ? 3 : templates.length > 0 ? 2 : recipients.length > 0 ? 1 : 0;
  const currentStepIndex = Math.max(activeWorkflowStep, computedStep);
  const fieldOptions = getAvailableFieldKeys(recipients);
  const categories = getCategories(recipients);

  // Compute initials for header avatar (default to "PC" per screenshot)
  const avatarInitials = "PC";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-gray-900 font-sans selection:bg-[#F9654B]/20 selection:text-[#F9654B] relative overflow-x-hidden w-full max-w-full min-w-0">
      {/* Decorative Subtle Certificate Line-Art Background */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-60"
        style={{
          backgroundImage: `url('/cert_bg_pattern.svg')`,
          backgroundRepeat: 'repeat',
          backgroundSize: '360px 360px',
          backgroundPosition: 'center top',
        }}
      />

      <div className="relative z-10">
        {/* 1. TOP HEADER */}
      <header className="h-11 border-b border-gray-200 bg-white sticky top-0 z-30 flex items-center">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between">
          {/* LEFT: Logo & Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#F9654B] flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm tracking-tight">Certify</span>
          </div>

          {/* RIGHT: Status & User Avatar */}
          <div className="flex items-center gap-3 relative">
            <span className="text-xs text-gray-400 font-normal">Draft certificate</span>
            
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center border border-gray-200 hover:border-gray-300 transition-colors"
              title={userEmail || "User settings"}
            >
              {avatarInitials}
            </button>

            {/* Account dropdown popover preserving auth controls */}
            {showUserMenu && (
              <div className="absolute right-0 top-8 w-60 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 text-xs text-gray-700">
                {userEmail && <p className="font-medium text-gray-900 truncate mb-1">{userEmail}</p>}
                <div className="py-1.5 border-t border-b border-gray-100 my-1.5 space-y-1">
                  {googleConnected ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Gmail: {googleEmail}
                    </div>
                  ) : (
                    <a
                      href="/api/auth/gmail/connect"
                      className="text-[#F9654B] hover:underline font-medium block"
                    >
                      + Connect Gmail account
                    </a>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-rose-600 hover:text-rose-700 font-medium pt-1"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* GMAIL DENIED PERMISSION WARNING BANNER */}
      {gmailDenied && (
        <div className="w-full max-w-4xl mx-auto px-4 pt-4 relative z-20">
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-xs sm:text-sm font-bold text-amber-900">
                  Tick the Gmail permission box on the Google screen
                </p>
                <p className="text-xs text-amber-700">
                  Certify requires permission to send emails on your behalf to dispatch certificates through your Gmail account.
                </p>
              </div>
            </div>
            <a
              href="/api/auth/gmail/connect"
              className="bg-[#F9654B] hover:bg-[#E04F34] text-white text-xs font-semibold px-4 py-2.5 min-h-[44px] sm:min-h-0 rounded-xl transition-colors shrink-0 flex items-center justify-center shadow-xs"
            >
              Reconnect
            </a>
          </div>
        </div>
      )}

      {/* 2. WORKFLOW STEPPER */}
      <div className="bg-white border-b border-gray-100 sticky top-11 z-20">
        {/* Mobile Step Header (Compact + Thin Progress Bar + Horizontal Pill Scroll) */}
        <div className="block sm:hidden border-b border-gray-100">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900">
              Step {currentStepIndex + 1} of 5 — <span className="text-[#F9654B]">{STEPS[currentStepIndex].label}</span>
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              {Math.round(((currentStepIndex + 1) / 5) * 100)}%
            </span>
          </div>
          {/* Thin Progress Bar */}
          <div className="w-full h-1 bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#F9654B] transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / 5) * 100}%` }}
            />
          </div>
          {/* Horizontally Scrollable Step Pills (No Clipping) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-3 py-2 min-w-0 max-w-full">
            {STEPS.map((step, idx) => {
              const isCurrent = idx === currentStepIndex;
              return (
                <button
                  key={step.num}
                  onClick={() => {
                    if (recipients.length > 0) setActiveWorkflowStep(idx);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shrink-0 transition-colors ${
                    isCurrent
                      ? "bg-[#FFF0ED] text-[#F9654B] font-semibold border border-[#F9654B]/30"
                      : "bg-gray-50 text-gray-500 font-normal border border-gray-200"
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${isCurrent ? "bg-[#F9654B] text-white" : "bg-gray-200 text-gray-600"}`}>
                    {step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop Stepper */}
        <div className="hidden sm:flex py-5 items-center justify-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-3 text-xs select-none">
            {STEPS.map((step, idx) => {
              const isCurrent = idx === currentStepIndex;

              return (
                <div key={step.num} className="flex items-center">
                  <button
                    onClick={() => {
                      if (recipients.length > 0) setActiveWorkflowStep(idx);
                    }}
                    className="flex items-center gap-1.5 text-left focus:outline-none"
                  >
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-medium transition-colors ${
                        isCurrent
                          ? "border border-gray-900 bg-white text-gray-900"
                          : "border border-gray-300 bg-white text-gray-400"
                      }`}
                    >
                      {step.num}
                    </div>
                    <span
                      className={`text-xs ${
                        isCurrent ? "font-semibold text-gray-900" : "text-gray-400 font-normal"
                      }`}
                    >
                      {step.label}
                    </span>
                  </button>

                  {idx < STEPS.length - 1 && (
                    <svg className="w-3.5 h-3.5 text-gray-300 mx-2 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. MAIN CONTENT */}
      {/* STEP 1 INITIAL DATA IMPORT VIEW */}
      {activeWorkflowStep === 0 && (
        <div className="w-full max-w-[505px] mx-auto px-3 sm:px-4 pt-6 sm:pt-9 pb-36 sm:pb-16 min-w-0 max-w-full">
          {/* Step Pill */}
          <div className="text-center mb-3">
            <span className="px-3 py-1 bg-[#FFF0ED] text-[#F9654B] text-[11px] font-semibold rounded-full inline-block">
              Step 1 of 5
            </span>
          </div>

          {/* Main Heading & Subtitle */}
          <h1 className="text-xl sm:text-[28px] font-bold text-gray-900 text-center tracking-tight mb-2 px-2">
            Add your recipient list
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 text-center max-w-[420px] mx-auto leading-relaxed mb-6 px-2">
            Upload a spreadsheet with the names and details you want to use on your certificates.
          </p>

          {/* 4. IMPORT METHOD TABS */}
          <div className="flex items-center justify-center gap-6 sm:gap-8 border-b border-gray-200 mb-6">
            <button
              onClick={() => setImportMode("file")}
              className={`pb-2.5 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px] ${
                importMode === "file"
                  ? "text-gray-900 border-b-2 border-[#F9654B]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Upload file
            </button>
            
            <button
              onClick={() => setImportMode("sheet")}
              className={`pb-2.5 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px] ${
                importMode === "sheet"
                  ? "text-gray-900 border-b-2 border-[#F9654B]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Google Sheet
            </button>
          </div>

          {/* 5. SPREADSHEET UPLOAD AREA / GOOGLE SHEET IMPORT */}
          {importMode === "file" ? (
            <UploadExcel onParsed={setRecipients} />
          ) : (
            <GoogleSheetImport onImported={setRecipients} />
          )}

          {/* 6. INFORMATION / VALIDATION NOTE */}
          <div className="mt-4 w-full bg-[#F3F4F6] rounded-xl p-3.5 flex items-start gap-2.5 text-left">
            <svg className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs leading-relaxed text-gray-600">
              <span className="font-semibold text-gray-900">Before uploading:</span> Include a header row and one column for each certificate detail, such as name, email, or course.
            </p>
          </div>

          {/* Summary of parsed recipients if uploaded */}
          {recipients.length > 0 && (
            <div className="mt-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-left">
              <div className="flex items-center justify-between text-xs flex-wrap gap-1">
                <span className="font-semibold text-emerald-800">
                  ✓ {validCount} recipient{validCount === 1 ? "" : "s"} loaded successfully
                </span>
                {failedCount > 0 && (
                  <span className="text-rose-600 font-medium">
                    {failedCount} require normalization
                  </span>
                )}
              </div>
              <FailedRowsFix recipients={recipients} onUpdate={setRecipients} />
            </div>
          )}

          {/* 7. BOTTOM STICKY ACTION AREA (Safe Area Padding for Mobile) */}
          <div className="border-t border-gray-200 my-6 hidden sm:block" />
          
          <div
            className="fixed sm:relative bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md sm:bg-transparent border-t sm:border-0 border-gray-200 p-3 sm:p-0 flex justify-end shadow-lg sm:shadow-none"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <button
              onClick={() => setActiveWorkflowStep(1)}
              disabled={recipients.length === 0}
              className="w-full sm:w-auto bg-[#F9654B] hover:bg-[#E04F34] text-white text-sm font-medium px-6 py-3 min-h-[44px] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Continue to design →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2+ WIDE WORKSPACE VERTICAL STACK */}
      {activeWorkflowStep >= 1 && (
        <div className="w-full max-w-[1450px] mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 pb-36 sm:pb-8 min-w-0 max-w-full">
          {/* Workspace Subheader */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-3 py-0.5 bg-[#FFF0ED] text-[#F9654B] text-xs font-semibold rounded-full">
                  Step 2 of 5
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {validCount} recipient{validCount === 1 ? "" : "s"} active
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Design & Tag Placement
              </h1>
            </div>
            <button
              onClick={() => setActiveWorkflowStep(0)}
              className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3.5 py-2 min-h-[44px] sm:min-h-0 font-medium transition-colors w-full sm:w-auto text-center"
            >
              ← Back to Recipient List
            </button>
          </div>

          {/* Section 1: Template Manager Workspace */}
          <section className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xs text-gray-900 min-w-0 max-w-full">
            <div className="mb-4 sm:mb-6 border-b border-gray-200 pb-4">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Canvas & Tag Placement Workspace</h2>
              <p className="text-xs text-gray-500">
                {categories.length > 1
                  ? `${categories.length} cohorts detected. Assign a template layout for each group.`
                  : "Upload your certificate artwork and place positional placeholders onto the canvas."}
              </p>
            </div>
            <TemplateManager categories={categories} fieldOptions={fieldOptions} onReady={setTemplates} />
          </section>

          {/* Section 2: Local Generation (Full Width Stacked Below Canvas) */}
          <section className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xs text-gray-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 max-w-full">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Local Generation Engine</h2>
              <p className="text-xs text-gray-500">
                Renders high-DPI PDFs completely on client browser threads without sending template artwork to remote servers.
              </p>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <button
                onClick={handleGenerate}
                disabled={templates.length === 0 || recipients.length === 0 || generating}
                className="w-full sm:w-auto bg-[#F9654B] hover:bg-[#E04F34] text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold px-6 py-3 min-h-[44px] rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {generating ? "Building Assets..." : `Generate ${validCount} Output Assets`}
              </button>
            </div>
          </section>

          {generating && (
            <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
              <ProgressBar done={genProgress.done} total={genProgress.total} />
            </div>
          )}

          {/* Section 3: Inspection Grid (Full Width Stacked Below Local Generation) */}
          <section className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xs text-gray-900 min-w-0 max-w-full">
            <div className="flex items-center justify-between mb-4 sm:mb-6 border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Inspection Grid</h2>
                <p className="text-xs text-gray-500">Preview all generated certificate thumbnails before dispatching.</p>
              </div>
              {certs.length > 0 && (
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg shrink-0">
                  {certs.length} Rendered
                </span>
              )}
            </div>

            {certs.length > 0 ? (
              <PreviewGrid certs={certs} recipients={recipients} />
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 sm:p-10 text-center text-xs text-gray-500">
                Certificates will be displayed here after running local generation.
              </div>
            )}
          </section>

          {/* Section 4: Direct Delivery (Full Width Stacked Below Inspection Grid) */}
          <section className="w-full bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xs text-gray-900 min-w-0 max-w-full">
            <div className="border-b border-gray-200 pb-4 mb-4 sm:mb-6">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Direct Delivery Engine</h2>
              <p className="text-xs text-gray-500">Batch email generated certificate PDFs directly to recipient mailboxes.</p>
              {!googleConnected && (
                <a href="/api/auth/gmail/connect" className="text-xs text-[#F9654B] mt-2 font-medium underline block">Connect Gmail</a>
              )}
            </div>
            <SendPanel certs={certs} recipients={recipients} />
          </section>
        </div>
      )}

      </div>
    </main>
  );
}



