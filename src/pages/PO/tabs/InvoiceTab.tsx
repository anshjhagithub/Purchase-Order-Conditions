import { useState } from 'react';
import { FileSpreadsheet, Plus, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import type { AppliedCondition, InvoiceClaim, InvoiceClaimStatus, PurchaseOrder } from '../../../types';
import { INVOICE_CLAIM_STATUS_LABELS } from '../../../types';
import { computePO, formatCurrency, type VendorPayable } from '../../../engine/calc';
import { VENDORS } from '../../../data/seed';
import { uid } from '../../../data/ids';
import { useData } from '../../../context/DataContext';
import { Modal } from '../../../components/ui/Modal';
import { Field, TextInput } from '../../../components/ui/Form';

// Variance beyond this % routes to approval instead of auto-matching (mirrors
// the freight quantity-tolerance discussion — small GRN-qty overages shouldn't
// block payment, but anything material should).
const AUTO_MATCH_TOLERANCE_PCT = 1;

const CLAIM_STATUS_STYLE: Record<InvoiceClaimStatus, string> = {
  MATCHED: 'bg-emerald-50 text-emerald-700',
  VARIANCE_PENDING: 'bg-rose-50 text-rose-700',
  APPROVED: 'bg-sky-50 text-sky-700',
  ON_HOLD_GRN: 'bg-slate-100 text-slate-600',
};

function ClaimStatusBadge({ status }: { status: InvoiceClaimStatus }) {
  return <span className={`badge ${CLAIM_STATUS_STYLE[status]}`}>{INVOICE_CLAIM_STATUS_LABELS[status]}</span>;
}

// All AppliedConditions (line + header) that this vendor payable is built from —
// used to (a) check GRN-confirmation gating and (b) snapshot conditionIds on the claim.
function conditionsForVendor(po: PurchaseOrder, vendorId: string): AppliedCondition[] {
  const all = [...po.lines.flatMap((l) => l.conditions), ...po.headerConditions];
  return all.filter((c) => c.vendorId === vendorId && !c.statistical);
}

// A vendor's conditions block invoicing while any of them still requires service
// confirmation and hasn't reached it yet — this is the "freight invoice arrives
// before GRN" edge case: park it rather than attempting to match a moving number.
function isBlockedOnGrn(conditions: AppliedCondition[]): boolean {
  return conditions.some((c) => c.requiresServiceConfirmation && c.status !== 'Confirmed');
}

export function InvoiceTab({ po }: { po: PurchaseOrder }) {
  const { upsertPO } = useData();
  const comp = computePO(po, VENDORS);
  const claims = po.invoiceClaims ?? [];

  const [raisingFor, setRaisingFor] = useState<VendorPayable | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [claimedAmount, setClaimedAmount] = useState('');
  const [spansOtherPOs, setSpansOtherPOs] = useState(false);

  const resetForm = () => {
    setRaisingFor(null);
    setInvoiceNumber('');
    setClaimedAmount('');
    setSpansOtherPOs(false);
  };

  const submitClaim = () => {
    if (!raisingFor || !invoiceNumber.trim() || !claimedAmount) return;
    const planned = raisingFor.amount;
    const claimed = Number(claimedAmount);
    const varianceAmount = Math.round((claimed - planned) * 100) / 100;
    const variancePct = planned !== 0 ? Math.abs((varianceAmount / planned) * 100) : 0;
    const status: InvoiceClaimStatus = variancePct <= AUTO_MATCH_TOLERANCE_PCT ? 'MATCHED' : 'VARIANCE_PENDING';

    const newClaim: InvoiceClaim = {
      id: uid('claim'),
      vendorId: raisingFor.vendorId,
      vendorName: raisingFor.vendorName,
      invoiceNumber: invoiceNumber.trim(),
      invoiceDate,
      plannedAmount: planned,
      claimedAmount: claimed,
      varianceAmount,
      variancePct: Math.round(variancePct * 100) / 100,
      status,
      spansOtherPOs,
      conditionIds: conditionsForVendor(po, raisingFor.vendorId).map((c) => c.id),
    };
    upsertPO({ ...po, invoiceClaims: [...claims, newClaim] });
    resetForm();
  };

  const approveVariance = (claimId: string) => {
    upsertPO({
      ...po,
      invoiceClaims: claims.map((c) => (c.id === claimId ? { ...c, status: 'APPROVED' } : c)),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[20px] font-bold text-slate-900">
          <FileSpreadsheet size={20} /> Invoices — vendor-wise matching
        </div>
      </div>
      <p className="text-[12.5px] text-slate-400">
        Each vendor on this PO — material, freight, customs, insurance — invoices separately. A claim matches against that
        vendor's own computed payable, not the PO total.
      </p>

      <div className="space-y-4">
        {comp.vendorPayables.map((vp) => {
          const vendorConditions = conditionsForVendor(po, vp.vendorId);
          const isMaterialVendor = vp.vendorId === po.vendorId;
          const blocked = isBlockedOnGrn(vendorConditions);
          const vendorClaims = claims.filter((c) => c.vendorId === vp.vendorId);

          return (
            <div key={vp.vendorId + (vp.isRcm ? '-rcm' : '')} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <div>
                  <div className="flex items-center gap-2 text-[14px] font-bold text-slate-800">
                    {vp.vendorName}
                    {isMaterialVendor && <span className="badge bg-slate-100 text-slate-500">Material vendor</span>}
                    {!isMaterialVendor && <span className="badge bg-sky-50 text-sky-700">Condition vendor</span>}
                    {vp.isRcm && <span className="badge bg-violet-50 text-violet-700">RCM</span>}
                  </div>
                  <div className="text-[11.5px] text-slate-400">
                    Planned payable: <span className="font-semibold text-slate-600">{formatCurrency(vp.amount, po.currency)}</span>
                    {!isMaterialVendor && <> · {vendorConditions.map((c) => c.conditionName).join(', ')}</>}
                  </div>
                </div>
                {blocked ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[11.5px] font-medium text-slate-500">
                    <Clock size={13} /> Awaiting GRN confirmation
                  </span>
                ) : (
                  <button onClick={() => { setRaisingFor(vp); setClaimedAmount(String(vp.amount)); }} className="btn-dark flex items-center gap-1.5 !py-2 !text-[12px]">
                    <Plus size={13} /> Raise invoice
                  </button>
                )}
              </div>

              {vendorClaims.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {vendorClaims.map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
                          {claim.invoiceNumber}
                          {claim.spansOtherPOs && <span className="badge bg-purple-50 text-purple-700">Spans other POs</span>}
                        </div>
                        <div className="text-[11.5px] text-slate-400">{new Date(claim.invoiceDate).toLocaleDateString('en-IN')}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-[12px] text-slate-500">
                          {formatCurrency(claim.plannedAmount, po.currency)}
                          <ArrowRight size={11} className="mx-1 inline text-slate-300" />
                          <span className="font-semibold text-slate-800">{formatCurrency(claim.claimedAmount, po.currency)}</span>
                          {Math.abs(claim.varianceAmount) > 0.005 && (
                            <span className={claim.varianceAmount > 0 ? 'ml-1.5 text-rose-500' : 'ml-1.5 text-emerald-600'}>
                              ({claim.varianceAmount > 0 ? '+' : ''}
                              {formatCurrency(claim.varianceAmount, po.currency)}, {claim.variancePct}%)
                            </span>
                          )}
                        </div>
                        <ClaimStatusBadge status={claim.status} />
                        {claim.status === 'VARIANCE_PENDING' && (
                          <button onClick={() => approveVariance(claim.id)} className="flex items-center gap-1 text-[11px] font-semibold text-indigo-brand">
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {comp.vendorPayables.length === 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white text-center">
            <FileSpreadsheet size={24} className="text-slate-300" />
            <div className="text-[13px] text-slate-400">No vendor payables on this PO yet.</div>
          </div>
        )}
      </div>

      {raisingFor && (
        <Modal open onClose={resetForm} title="Raise invoice" subtitle={raisingFor.vendorName} width={480}>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[12.5px] text-slate-600">
              Planned payable for this vendor: <span className="font-semibold">{formatCurrency(raisingFor.amount, po.currency)}</span>
            </div>
            <Field label="Invoice number" required>
              <TextInput value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. FRT-2026-0142" />
            </Field>
            <Field label="Invoice date" required>
              <TextInput type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </Field>
            <Field label="Claimed amount" required hint={`Variance over ${AUTO_MATCH_TOLERANCE_PCT}% routes to approval instead of auto-matching.`}>
              <TextInput type="number" value={claimedAmount} onChange={(e) => setClaimedAmount(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
              <input type="checkbox" checked={spansOtherPOs} onChange={(e) => setSpansOtherPOs(e.target.checked)} />
              This invoice also covers other purchase orders (consolidated vendor bill)
            </label>
            {spansOtherPOs && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-[11.5px] leading-snug text-amber-800">
                  Only this PO's share is recorded here. In production this claim would allocate across every linked PO by
                  the condition's distribution basis, rather than needing a separate invoice attempt per PO.
                </p>
              </div>
            )}
            <button onClick={submitClaim} disabled={!invoiceNumber.trim() || !claimedAmount} className="btn-dark w-full !py-2.5 disabled:cursor-not-allowed disabled:opacity-40">
              Submit claim
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
