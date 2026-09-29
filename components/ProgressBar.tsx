export default function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div>
      <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
        <div className="bg-gradient-to-r from-accent to-accent2 h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted mt-1.5">{done}/{total} done</p>
    </div>
  );
}