import type { PurchaseOrder } from '../../../types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-[13.5px] font-medium text-slate-700">{value}</div>
    </div>
  );
}

export function RequesterInputTab({ po }: { po: PurchaseOrder }) {
  const isApproved = po.stageIndex >= 3;

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 text-[14px] font-bold text-slate-800">Requester Input</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Raised By" value={po.createdBy} />
          <Field label="Office" value={po.office} />
          <Field label="Super Category" value={po.spendSuperCategory} />
          <Field label="Category" value={po.spendCategory} />
          <Field label="Incoterm" value={po.incoterm ?? '—'} />
          <Field label="Delivery State" value={po.deliveryState} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 text-[14px] font-bold text-slate-800">Approver Input</div>
        {isApproved ? (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">
            Approved by {po.owner}. No additional remarks.
          </div>
        ) : (
          <div className="text-[13px] text-slate-400">No approver comments yet — this PO is still at {po.stage.toLowerCase()}.</div>
        )}
      </div>
    </div>
  );
}
