import { GeneratedCert, Recipient } from '@/types';

export default function CertThumbnail({ cert, recipient }: { cert: GeneratedCert; recipient: Recipient }) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:border-[#F9654B]/50 transition-all shadow-xs group">
      <div className="aspect-video w-full overflow-hidden bg-gray-50 flex items-center justify-center p-1">
        <img src={cert.thumbnailUrl} alt={recipient.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
      </div>
      <div className="p-3 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-900 truncate">{recipient.name}</p>
        <p className="text-[11px] text-gray-500 truncate">{recipient.email}</p>
      </div>
    </div>
  );
}
