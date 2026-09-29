import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0908] flex items-center justify-center text-xs text-[#8C8270]">Loading...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

