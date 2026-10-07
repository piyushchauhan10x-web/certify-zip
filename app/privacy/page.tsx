export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-text">
      <h1 className="font-display font-bold text-2xl mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p>Last updated: 7 October 2026</p>
        <h2 className="text-text font-semibold text-base mt-6">What we collect</h2>
        <p>Supabase Auth manages your email, securely hashed password and sign-in session. Google login provides your account identity and profile. If you connect Gmail, we store the connected email address, granted permissions and access and refresh tokens on the server, linked only to your user account.</p>
        <h2 className="text-text font-semibold text-base mt-6">What we don&apos;t do</h2>
        <p>Uploaded recipient lists and certificate artwork are processed in your browser. Google Sheets imports pass through our server. When you request delivery, recipient details and email content pass through our server and the generated PDF is temporarily uploaded to a private Supabase bucket. We delete the temporary PDF after each sending attempt. Interrupted uploads or failed cleanup may require administrative deletion. We do not sell your data.</p>
        <h2 className="text-text font-semibold text-base mt-6">Gmail access</h2>
        <p>Gmail permission is used only to send emails you request. We never read your inbox. We also request read-only Google Sheets access for the sheet import feature. Google and Supabase process data needed to provide these services; a configured Resend fallback may process deliveries when Gmail is not connected.</p>
        <h2 className="text-text font-semibold text-base mt-6">Data deletion</h2>
        <p>Contact us to request account and data deletion at any time.</p>
        <h2 className="text-text font-semibold text-base mt-6">Contact</h2>
        <p>For privacy questions or deletion requests, contact piyushchauhan10x@gmail.com. You can revoke Google permissions in your Google Account settings.</p>
      </div>
    </main>
  );
}
