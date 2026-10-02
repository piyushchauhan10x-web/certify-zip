'use client';
import { GeneratedCert, Recipient } from '@/types';
import CertThumbnail from './CertThumbnail';

export default function PreviewGrid({ certs, recipients }: { certs: GeneratedCert[]; recipients: Recipient[] }) {
  const recMap = new Map(recipients.map((r) => [r.id, r]));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0 max-w-full">
      {certs.map((cert) => {
        const recipient = recMap.get(cert.recipientId);
        if (!recipient) return null;
        return <CertThumbnail key={cert.recipientId} cert={cert} recipient={recipient} />;
      })}
    </div>
  );
}