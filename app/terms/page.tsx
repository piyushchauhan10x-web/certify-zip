export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 text-text">
      <h1 className="font-display font-bold text-2xl mb-6">Terms of Service</h1>
      <div className="space-y-4 text-sm text-muted leading-relaxed">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <h2 className="text-text font-semibold text-base mt-6">Use of service</h2>
        <p>Certify is provided as-is for generating and sending certificates. You are responsible for the accuracy of data you upload and emails you send.</p>
        <h2 className="text-text font-semibold text-base mt-6">Acceptable use</h2>
        <p>Do not use this service to send spam, unsolicited bulk email, or content that violates Gmail&apos;s sending policies. Your Gmail account&apos;s own sending limits apply.</p>
        <h2 className="text-text font-semibold text-base mt-6">Limitation of liability</h2>
        <p>We are not liable for delivery failures, Gmail account restrictions, or data loss resulting from use of this service.</p>
        <h2 className="text-text font-semibold text-base mt-6">Changes</h2>
        <p>We may update these terms; continued use constitutes acceptance.</p>
      </div>
    </main>
  );
}
