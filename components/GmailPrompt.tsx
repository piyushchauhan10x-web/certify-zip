"use client";
import { useEffect, useRef } from "react";
import ConnectGmail from "./ConnectGmail";

export default function GmailPrompt({ onDismiss }: { onDismiss: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} onCancel={onDismiss} aria-labelledby="gmail-prompt-title" aria-describedby="gmail-prompt-description"
      className="w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-lg backdrop:bg-black/30">
      <h2 id="gmail-prompt-title" className="text-lg font-bold mb-3">Connect Gmail to Certify?</h2>
      <p id="gmail-prompt-description" className="text-sm text-gray-600 mb-6">Would you like to connect your Gmail account so Certify can send emails on your behalf? This is optional, and you can connect Gmail later from the account menu.</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <ConnectGmail className="w-full min-h-[44px] rounded-xl bg-[#F9654B] hover:bg-[#E04F34] px-4 py-3 text-sm font-medium text-white disabled:opacity-50">Yes, Connect Gmail</ConnectGmail>
        <button type="button" autoFocus onClick={onDismiss} className="min-h-[44px] rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium hover:bg-gray-50">Not Now</button>
      </div>
    </dialog>
  );
}
