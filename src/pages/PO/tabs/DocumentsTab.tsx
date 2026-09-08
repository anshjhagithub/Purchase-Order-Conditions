import { FileText, Upload } from 'lucide-react';
import type { PurchaseOrder } from '../../../types';

export function DocumentsTab({ po }: { po: PurchaseOrder }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-bold text-slate-800">Documents</div>
        <button title="Upload a document — not wired up in this prototype" className="btn-secondary !py-2 !text-[12.5px]">
          <Upload size={14} /> Upload Document
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex h-11 w-9 items-center justify-center rounded bg-rose-500 text-white">
          <FileText size={17} />
        </div>
        <div className="flex-1">
          <div className="text-[13.5px] font-semibold text-slate-800">{po.poNumber}.pdf</div>
          <div className="text-[11.5px] text-slate-400">Auto-generated PO copy · sent to {po.vendorName}</div>
        </div>
      </div>

      <div className="flex h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
        <div className="text-[13px] text-slate-400">No other documents attached to this PO.</div>
      </div>
    </div>
  );
}
