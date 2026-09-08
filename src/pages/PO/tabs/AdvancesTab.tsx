import { Wallet } from 'lucide-react';

export function AdvancesTab() {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Wallet size={24} />
      </div>
      <div className="text-[13.5px] text-slate-400">No advances raised against this PO.</div>
      <div className="max-w-xs text-[12px] text-slate-300">Advances raised here would be settled automatically against invoices submitted for this PO.</div>
    </div>
  );
}
