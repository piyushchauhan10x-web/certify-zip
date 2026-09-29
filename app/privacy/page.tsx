export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-text">
      <h1 className="font-display font-bold text-2xl mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2 className="text-text font-semibold text-base mt-6">What we collect</h2>
        <p>We store your account email and a securely hashed password. If you connect Gmail, we store your Gmail access and refresh tokens to send emails on your behalf.</p>
        <h2 className="text-text font-semibold text-base mt-6">What we don&apos;t do</h2>
        <p>Certificate data (names, emails from your uploaded sheets) is processed entirely in your browser. We never receive, store, or see this data on our servers, except the final recipient email address at the moment of sending.</p>
        <h2 className="text-text font-semibold text-base mt-6">Gmail access</h2>
        <p>We request the minimum Gmail scope needed to send email on your behalf. We never read your inbox or access other Gmail data.</p>
        <h2 className="text-text font-semibold text-base mt-6">Data deletion</h2>
        <p>Contact us to request account and data deletion at any time.</p>
        <h2 className="text-text font-semibold text-base mt-6">Contact</h2>
        <p>For privacy questions, reach out via the contact details on our homepage.</p>
      </div>
    </main>
  );
}
