import { useState } from 'react';
import { CheckCircle2, Clock, PackageCheck } from 'lucide-react';
import type { AppliedCondition, POLine, PurchaseOrder } from '../../../types';
import { useData } from '../../../context/DataContext';
import { formatCurrency } from '../../../engine/calc';
import { Modal } from '../../../components/ui/Modal';
import { TextInput } from '../../../components/ui/Form';
import { StatusBadge } from '../../../components/ui/Badge';

interface ConditionRow {
  line: POLine | null; // null = header condition, applies to the whole PO
  condition: AppliedCondition;
}

export function GRNTab({ po }: { po: PurchaseOrder }) {
  const { upsertPO } = useData();
  const [grnLineId, setGrnLineId] = useState<string | null>(null);
  const [grnQty, setGrnQty] = useState('');

  const pendingLines = po.lines.filter((l) => l.qty - l.deliveredQty > 0);
  const pastLines = po.lines.filter((l) => l.deliveredQty > 0 && l.qty - l.deliveredQty <= 0);
  const conditionRows: ConditionRow[] = [
    ...po.lines.flatMap((line) => line.conditions.map((condition) => ({ line, condition }))),
    ...po.headerConditions.map((condition) => ({ line: null, condition })),
  ];

  const confirmSideEffects = (line: POLine, deliveredQty: number): POLine => ({
    ...line,
    conditions: line.conditions.map((c) => {
      if (!c.requiresServiceConfirmation || !c.autoConfirmOnMainGrn) return c;
      if (c.confirmationMode === 'FULL_ON_FIRST_GRN') {
        return deliveredQty > 0 ? { ...c, status: 'Confirmed', confirmedPct: 100 } : c;
      }
      const pct = Math.min(100, Math.round((deliveredQty / line.qty) * 1000) / 10);
      return { ...c, confirmedPct: pct, status: pct >= 100 ? 'Confirmed' : pct > 0 ? 'Partially Confirmed' : 'Draft' };
    }),
  });

  const recordGrn = (lineId: string) => {
    const qty = Number(grnQty);
    if (!qty || qty <= 0) return;
    const next: PurchaseOrder = { ...po, lines: po.lines.map((l) => ({ ...l, conditions: [...l.conditions] })) };
    const idx = next.lines.findIndex((l) => l.id === lineId);
    const deliveredQty = Math.min(next.lines[idx].qty, next.lines[idx].deliveredQty + qty);
    next.lines[idx] = confirmSideEffects({ ...next.lines[idx], deliveredQty }, deliveredQty);
    upsertPO(next);
    setGrnQty('');
  };

  const manualConfirm = (lineId: string | null, conditionId: string) => {
    const next: PurchaseOrder = {
      ...po,
      lines: po.lines.map((l) => ({ ...l, conditions: [...l.conditions] })),
      headerConditions: [...po.headerConditions],
    };
    if (lineId) {
      const idx = next.lines.findIndex((l) => l.id === lineId);
      next.lines[idx].conditions = next.lines[idx].conditions.map((c) => (c.id === conditionId ? { ...c, status: 'Confirmed', confirmedPct: 100 } : c));
    } else {
      next.headerConditions = next.headerConditions.map((c) => (c.id === conditionId ? { ...c, status: 'Confirmed', confirmedPct: 100 } : c));
    }
    upsertPO(next);
  };

  const modalLine = po.lines.find((l) => l.id === grnLineId) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[20px] font-bold text-slate-900">
        <PackageCheck size={20} /> Goods Received Note (GRN)
      </div>

      {/* Pending GRN Items */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">Pending GRN Items:</div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Details</th>
                <th>Date</th>
                <th>Quantity/Unit</th>
                <th>Delivered</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingLines.map((line) => (
                <tr key={line.id}>
                  <td>
                    <div className="font-semibold text-slate-800">{line.itemName}</div>
                    <div className="text-[11.5px] text-slate-400">
                      Item Ref no: {line.itemRef}
                      <br />
                      Vendor: {po.vendorName}
                    </div>
                  </td>
                  <td className="text-[12.5px] text-slate-500">{new Date(line.deliveryDate).toLocaleDateString('en-IN')}</td>
                  <td>
                    {line.qty - line.deliveredQty}/ {line.uom}
                  </td>
                  <td>{line.deliveredQty}</td>
                  <td>
                    <button onClick={() => setGrnLineId(line.id)} className="btn-dark !py-2 !text-[12px]">
                      GRN
                    </button>
                  </td>
                </tr>
              ))}
              {pendingLines.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No pending GRN items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Past GRN Items */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">Past GRN Items:</div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Reference No</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pastLines.map((line) => (
                <tr key={line.id}>
                  <td className="font-medium text-slate-700">
                    GRN-{po.poNumber}-{line.lineNo}
                  </td>
                  <td className="text-[12.5px] text-slate-500">{new Date(line.deliveryDate).toLocaleDateString('en-IN')}</td>
                  <td>
                    <button onClick={() => setGrnLineId(line.id)} className="btn-secondary !px-3 !py-1.5 text-[12px]">
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {pastLines.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-400">
                    No Past Grn
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GRN records — this prototype tracks receipt at the line level (Delivered / Balance
          Qty) rather than as discrete GRN documents, so this list is always empty here too. */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="table-shell">
          <thead>
            <tr>
              <th>GRN ID</th>
              <th>Date</th>
              <th>Invoice ID</th>
              <th>Status</th>
              <th>Invoice Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="py-6 text-center text-slate-400">
                No GRNs
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* PO Conditions GRN */}
      <div>
        <div className="mb-2 text-[13px] font-bold text-slate-700">PO Conditions GRN:</div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Condition &amp; Vendor</th>
                <th>Date</th>
                <th>GRN Qty</th>
                <th>Invoice Qty</th>
                <th>Status</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {conditionRows.map(({ line, condition: c }) => {
                const grnQtyValue = Math.round(((c.confirmedPct / 100) * c.qty) * 10) / 10;
                const canManualConfirm = c.requiresServiceConfirmation && c.status !== 'Confirmed' && !c.autoConfirmOnMainGrn;
                const isAutoPending = c.requiresServiceConfirmation && c.status !== 'Confirmed' && c.autoConfirmOnMainGrn;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-slate-800">{c.conditionName}</div>
                      <div className="text-[11.5px] text-slate-400">
                        {c.vendorName} · {line ? line.itemName : 'Whole PO'}
                      </div>
                    </td>
                    <td className="text-[12.5px] text-slate-500">{new Date(line?.deliveryDate ?? po.createdAt).toLocaleDateString('en-IN')}</td>
                    <td>{c.requiresServiceConfirmation ? grnQtyValue : '—'}</td>
                    <td>{c.qty}</td>
                    <td>
                      {c.requiresServiceConfirmation ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={c.status} />
                          {canManualConfirm && (
                            <button onClick={() => manualConfirm(line?.id ?? null, c.id)} className="flex items-center gap-1 text-[11px] font-semibold text-indigo-brand">
                              <CheckCircle2 size={12} /> Confirm
                            </button>
                          )}
                          {isAutoPending && (
                            <span className="flex items-center gap-1 text-[10.5px] text-slate-400">
                              <Clock size={11} /> auto
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-300">n/a</span>
                      )}
                    </td>
                    <td className="font-semibold">{formatCurrency(c.rate, c.currency)}</td>
                    <td></td>
                  </tr>
                );
              })}
              {conditionRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No condition GRNs
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalLine && (
        <Modal open onClose={() => setGrnLineId(null)} title="Record GRN" subtitle={modalLine.itemName} width={560}>
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Main Item</div>
              <div className="flex items-center justify-between text-[13px] text-slate-600">
                <span>
                  Ordered: {modalLine.qty} {modalLine.uom}
                </span>
                <span>
                  Delivered: {modalLine.deliveredQty} {modalLine.uom}
                </span>
                <span className="font-semibold text-amber-600">
                  Balance: {modalLine.qty - modalLine.deliveredQty} {modalLine.uom}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <TextInput
                  type="number"
                  placeholder="Qty received"
                  value={grnQty}
                  onChange={(e) => setGrnQty(e.target.value)}
                  disabled={modalLine.qty - modalLine.deliveredQty <= 0}
                  className="!w-40"
                />
                <button
                  onClick={() => recordGrn(modalLine.id)}
                  disabled={modalLine.qty - modalLine.deliveredQty <= 0}
                  className="btn-dark !py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Record GRN
                </button>
              </div>
              <p className="mt-2 text-[11.5px] text-slate-400">Auto-confirms service conditions per their confirmation mode (§5.7 / §5.8).</p>
            </div>

            {modalLine.conditions.length > 0 && (
              <div>
                <div className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Conditions on this line</div>
                <div className="space-y-2">
                  {modalLine.conditions.map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5">
                      <div>
                        <div className="text-[13px] font-medium text-slate-800">{c.conditionName}</div>
                        <div className="text-[11.5px] text-slate-400">{c.vendorName}</div>
                      </div>
                      {c.requiresServiceConfirmation ? (
                        <div className="flex items-center gap-2">
                          <StatusBadge status={c.status} />
                          {c.status !== 'Confirmed' && !c.autoConfirmOnMainGrn && (
                            <button onClick={() => manualConfirm(modalLine.id, c.id)} className="flex items-center gap-1 text-[11px] font-semibold text-indigo-brand">
                              <CheckCircle2 size={12} /> Confirm
                            </button>
                          )}
                          {c.status !== 'Confirmed' && c.autoConfirmOnMainGrn && (
                            <span className="flex items-center gap-1 text-[10.5px] text-slate-400">
                              <Clock size={11} /> auto on main GRN
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[12px] text-slate-300">no confirmation required</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
