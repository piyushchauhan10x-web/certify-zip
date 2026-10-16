'use client';
import { useState } from 'react';
import { parseExcelFile, validateRecipients } from '@/lib/parseExcel';
import { Recipient } from '@/types';

export default function UploadExcel({ onParsed }: { onParsed: (r: Recipient[]) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError('');
    try {
      const parsed = await parseExcelFile(file);
      onParsed(validateRecipients(parsed));
    } catch (err: any) {
      console.error("[EXCEL_IMPORT] Recipient list parsing failed.");
      setError('Parse failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <label className="studio-upload w-full min-h-[240px] bg-white border-2 border-dashed border-gray-300 rounded-2xl p-4 sm:p-6 hover:border-[#17634D]/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer select-none relative min-w-0 max-w-full">
      <div className="w-9 h-9 rounded-xl bg-[#E7F0E9] text-[#17634D] flex items-center justify-center mb-3 shadow-xs">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
      </div>

      <span className="font-bold text-gray-900 text-sm mb-0.5">
        {fileName ? `Selected: ${fileName}` : 'Choose your recipient list'}
      </span>

      <span className="text-xs text-gray-400 mb-3">
        Browse a spreadsheet from your device
      </span>

      <span className="px-3 py-1 bg-[#EFEEE7] text-gray-500 rounded-md text-[11px] font-medium">
        CSV or XLSX • up to 50 MB
      </span>

      <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={loading} aria-label="Upload recipient spreadsheet" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait" />
      {loading && <span className="mt-2 text-xs text-[#17634D] font-medium animate-pulse">Parsing spreadsheet...</span>}
      {error && <span className="mt-2 text-xs text-red-500 font-medium">{error}</span>}
    </label>
  );
}