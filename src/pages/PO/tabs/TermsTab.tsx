import type { PurchaseOrder } from '../../../types';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-[13.5px] font-medium text-slate-700">{value}</div>
    </div>
  );
}

export function TermsTab({ po }: { po: PurchaseOrder }) {
  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 text-[14px] font-bold text-slate-800">Delivery Terms</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Incoterm" value={po.incoterm ?? '—'} />
          <Field label="Currency" value={po.currency} />
          <Field label="Delivery State" value={po.deliveryState} />
          <Field label="Delivery Address" value={po.deliveryAddress} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 text-[14px] font-bold text-slate-800">Payment Terms</div>
        <p className="text-[13px] leading-relaxed text-slate-600">
          Payment due Net 30 from invoice date, subject to GRN confirmation for goods and Service Confirmation for
          logistics, statutory and deduction conditions. TDS is withheld at source where applicable (Section 194Q).
          Retention amounts, if any, release on the condition's configured trigger.
        </p>
      </div>
    </div>
  );
}
