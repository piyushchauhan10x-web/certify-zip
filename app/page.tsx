"use client";

import { useState, useEffect, useRef } from "react";
import GmailPrompt from "@/components/GmailPrompt";
import { consumeGoogleLogin } from "@/lib/gmailPrompt";
import ConnectGmail from "@/components/ConnectGmail";
import { request, HttpError } from "@/lib/http";
import { authException, withAuthTimeout } from "@/lib/authUi";
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
  const [pageError, setPageError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "sheet">("file");
  const [gmailDenied, setGmailDenied] = useState(false);
  const [showGmailPrompt, setShowGmailPrompt] = useState(false);
  const [gmailNotice, setGmailNotice] = useState("");
  const loginIntent = useRef<boolean>();
  const connectionReturn = useRef(false);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [certs, setCerts] = useState<GeneratedCert[]>([]);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const [generating, setGenerating] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (loginIntent.current === undefined) {
        try { loginIntent.current = consumeGoogleLogin(window.sessionStorage, params.get("signed_in") === "1"); }
        catch { loginIntent.current = false; }
      }
      if (params.get("connected") === "1") connectionReturn.current = true;
      if (["denied", "reconnect"].includes(params.get("gmail") || "")) {
        setGmailDenied(true);
      }
      if (params.has("signed_in") || params.has("connected") || params.has("gmail")) {
        const url = new URL(window.location.href);
        ["signed_in", "connected", "gmail"].forEach(key => url.searchParams.delete(key));
        window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      }
    }

    request<{ loggedIn: boolean; googleConnected: boolean; googleEmail?: string; email?: string; connectionError?: string }>("/api/auth/me")
      .then(data => {
        if (cancelled) return;
        setGoogleConnected(data.googleConnected); setGoogleEmail(data.googleEmail || "");
        setUserEmail(data.email || ""); setAuthChecked(true);
        if (loginIntent.current && !data.googleConnected && !data.connectionError) setShowGmailPrompt(true);
        loginIntent.current = false;
        if (connectionReturn.current && data.googleConnected) setGmailNotice("Gmail connected. You can send certificates when you are ready.");
        if (data.connectionError) setPageError(data.connectionError);
      }).catch(error => {
        if (cancelled) return;
        console.error("[SESSION_CHECK] Could not load session.");
        if (error instanceof HttpError && error.status === 401) router.replace("/login");
        else setPageError(authException(error));
      });
    return () => { cancelled = true; };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const { error } = await withAuthTimeout((await createClient()).auth.signOut({ scope: "local" }));
      if (error) throw error;
      router.replace("/login"); router.refresh();
    } catch (error) { console.error("[LOGOUT] Sign-out failed."); setPageError(authException(error)); }
    finally { setLoggingOut(false); }
  }
  async function handleGenerate() {
    if (!templates.length || generating) return;
    setGenerating(true); setPageError(""); setGenProgress({ done: 0, total: recipients.length });
    try { setCerts(await generateAll(recipients, templates, (done, total) => setGenProgress({ done, total }))); }
    catch (error) { console.error("[GENERATE] Certificate generation failed."); setPageError(authException(error)); }
    finally { setGenerating(false); }
  }
  if (!authChecked) return <div className="p-6 max-w-xl mx-auto"><p role="alert">{pageError || "Checking your session…"}</p>{pageError && <a href="/login" className="underline">Back to login</a>}</div>;

  const validCount = recipients.filter((r) => r.status !== "failed").length;
  const failedCount = recipients.length - validCount;
  const computedStep = certs.length > 0 ? 3 : templates.length > 0 ? 2 : recipients.length > 0 ? 1 : 0;
  const currentStepIndex = Math.max(activeWorkflowStep, computedStep);
  const fieldOptions = getAvailableFieldKeys(recipients);
  const categories = getCategories(recipients);

  // Compute initials for header avatar (default to "PC" per screenshot)
  const avatarInitials = "PC";

  return (
    <main className="studio-app min-h-screen bg-[#F5F3ED] text-gray-900 font-sans selection:bg-[#17634D]/20 selection:text-[#17634D] relative overflow-x-hidden w-full max-w-full min-w-0">
      <div className="relative z-10">
      {showGmailPrompt && <GmailPrompt onDismiss={() => setShowGmailPrompt(false)} />}
      {gmailNotice && <p role="status" className="p-4 text-sm text-emerald-700 bg-emerald-50">{gmailNotice}</p>}
      {pageError && <p role="alert" className="p-4 text-sm text-red-700 bg-red-50 break-words">{pageError}</p>}
        {/* 1. TOP HEADER */}
      <header className="studio-header sticky top-0 z-30 flex items-center">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-10 w-full flex items-center justify-between">
          {/* LEFT: Logo & Brand */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#17634D] flex items-center justify-center text-white shrink-0 shadow-xs">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="studio-wordmark font-display font-bold text-xl tracking-tight">Certify</span>
          </div>

          {/* RIGHT: Status & User Avatar */}
          <div className="flex items-center gap-3 relative">
            <span className="studio-status text-xs font-medium">Certificate studio</span>

            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 text-[11px] font-semibold flex items-center justify-center border border-gray-200 hover:border-gray-300 transition-colors"
              title={userEmail || "User settings"}
            >
              {avatarInitials}
            </button>

            {/* Account dropdown popover preserving auth controls */}
            {showUserMenu && (
              <div className="absolute right-0 top-12 w-64 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50 text-xs text-gray-700">
                {userEmail && <p className="font-medium text-gray-900 truncate mb-1">{userEmail}</p>}
                <div className="py-1.5 border-t border-b border-gray-100 my-1.5 space-y-1">
                  {googleConnected ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Gmail: {googleEmail}
                    </div>
                  ) : (
                    <ConnectGmail

                      className="text-[#17634D] hover:underline font-medium block"
                    >
                      + Connect Gmail account
                    </ConnectGmail>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                    disabled={loggingOut}
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
            <ConnectGmail

              className="bg-[#17634D] hover:bg-[#104D3B] text-white text-xs font-semibold px-4 py-2.5 min-h-[44px] sm:min-h-0 rounded-xl transition-colors shrink-0 flex items-center justify-center shadow-xs"
            >
              Reconnect
            </ConnectGmail>
          </div>
        </div>
      )}

      {/* 2. WORKFLOW STEPPER */}
      <div className="studio-stepper border-b border-gray-200">
        {/* Mobile Step Header (Compact + Thin Progress Bar + Horizontal Pill Scroll) */}
        <div className="block sm:hidden border-b border-gray-100">
          <div className="px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-900">
              Step {currentStepIndex + 1} of 5 — <span className="text-[#17634D]">{STEPS[currentStepIndex].label}</span>
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              {Math.round(((currentStepIndex + 1) / 5) * 100)}%
            </span>
          </div>
          {/* Thin Progress Bar */}
          <div className="w-full h-1 bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-[#17634D] transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / 5) * 100}%` }}
            />
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
                    aria-current={isCurrent ? "step" : undefined}
                    className="studio-step flex items-center gap-2 text-left"
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
        <div className="studio-intro">
          <section className="studio-import" aria-labelledby="import-heading">
            <div className="studio-import-heading"><h2 id="import-heading">Add recipients</h2><p>Add a spreadsheet or import a Google Sheet.</p></div>
          {/* 4. IMPORT METHOD TABS */}
          <div className="studio-tabs flex items-center gap-6 border-b border-gray-200 mb-6">
            <button
              onClick={() => setImportMode("file")}
              className={`pb-2.5 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors min-h-[44px] ${
                importMode === "file"
                  ? "text-gray-900 border-b-2 border-[#17634D]"
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
                  ? "text-gray-900 border-b-2 border-[#17634D]"
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
          <div className="mt-4 w-full bg-[#EFEEE7] rounded-xl p-3.5 flex items-start gap-2.5 text-left">
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


          <div
            className="studio-import-action flex justify-end"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <button
              onClick={() => setActiveWorkflowStep(1)}
              disabled={recipients.length === 0}
              className="w-full sm:w-auto bg-[#17634D] hover:bg-[#104D3B] text-white text-sm font-medium px-6 py-3 min-h-[44px] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Continue to design →
            </button>
          </div>
          </section>
        </div>
      )}

      {/* STEP 2+ WIDE WORKSPACE VERTICAL STACK */}
      {activeWorkflowStep >= 1 && (
        <div className="studio-workspace w-full max-w-[1280px] mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 pb-36 sm:pb-8 min-w-0 max-w-full">
          {/* Workspace Subheader */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-200 pb-4 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="px-3 py-0.5 bg-[#E7F0E9] text-[#17634D] text-xs font-semibold rounded-full">
                  Step 2 of 5
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  {validCount} recipient{validCount === 1 ? "" : "s"} active
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Design your certificate
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
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Make it yours</h2>
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
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Bring your certificates to life</h2>
              <p className="text-xs text-gray-500">
                Create personalized PDFs in your browser, ready for review.
              </p>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              <button
                onClick={handleGenerate}
                disabled={templates.length === 0 || recipients.length === 0 || generating}
                className="w-full sm:w-auto bg-[#17634D] hover:bg-[#104D3B] text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-semibold px-6 py-3 min-h-[44px] rounded-xl transition-all shadow-xs cursor-pointer"
              >
                {generating ? "Creating certificates..." : `Generate ${validCount} certificates`}
              </button>
            </div>
          </section>

          {generating && (
            <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
              <ProgressBar done={genProgress.done} total={genProgress.total} />
            </div>
          )}

          {/* Section 3: A final look (Full Width Stacked Below Local Generation) */}
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
              <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-1">Ready to deliver</h2>
              <p className="text-xs text-gray-500">Batch email generated certificate PDFs directly to recipient mailboxes.</p>
            </div>
            <SendPanel certs={certs} recipients={recipients} />
          </section>
        </div>
      )}

      </div>
      <footer className="studio-footer flex justify-center gap-6 py-8 text-sm"><a href="/privacy">Privacy</a><a href="/terms">Terms</a></footer>
    </main>
  );
}



