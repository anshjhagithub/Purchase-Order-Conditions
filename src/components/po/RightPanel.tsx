
import { FileDown, CheckCircle2, FileText, MessageSquare } from 'lucide-react';
import type { PurchaseOrder } from '../../types';

export function RightPanel({ po }: { po: PurchaseOrder }) {
  return (
    <div className="flex w-[300px] shrink-0 flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[15px] font-bold text-slate-900">Timeline</div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-500">
              Overall TAT: &lt; 1m
            </div>
          </div>
          <button className="btn-amber !px-3 !py-2 text-[12px]">
            <FileDown size={14} /> Export
          </button>
        </div>

        <div className="mt-4 flex gap-3 border-l-2 border-emerald-200 pl-3">
          <CheckCircle2 size={16} className="-ml-[19px] mt-0.5 shrink-0 rounded-full bg-white text-emerald-500" />
          <div className="pb-1">
            <div className="text-[13px] font-bold text-slate-800">App Started</div>
            <div className="text-[12px] text-slate-400">
              Created by {po.createdBy} / Raised by {po.createdBy}
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] text-slate-400">
              <div>
                SENT ON: <span className="font-medium text-slate-500">{new Date(po.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div>
                ACTION: <span className="font-medium text-slate-500">{new Date(po.createdAt).toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-[15px] font-bold text-slate-900">Multiple Email</div>
        <div className="mt-2 text-[12.5px] text-slate-400">No Email Tagged</div>
        <button className="btn-dark mt-3 w-full">+ Add Email</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-[15px] font-bold text-slate-900">Support Ticket</div>
        <button className="btn-dark mt-3 w-full">+ Start Conversation</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-[15px] font-bold text-slate-900">PO copy send to vendor</div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-11 w-9 items-center justify-center rounded bg-rose-500 text-[10px] font-bold text-white">
            <FileText size={16} />
          </div>
          <button className="btn-dark flex-1">Send Copy</button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="text-[15px] font-bold text-slate-900">Contract List</div>
        <div className="mt-2 text-[12.5px] text-slate-400">No contract found</div>
      </div>

      <button className="fixed bottom-6 right-6 flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-3 text-[12.5px] font-semibold text-amber-800 shadow-lg">
        <MessageSquare size={15} /> Comments
      </button>
    </div>
  );
}
